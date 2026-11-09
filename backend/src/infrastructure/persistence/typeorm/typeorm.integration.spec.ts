import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { ReverseGeocodeUseCase } from '../../../application/reverse-geocode.usecase';
import { GeocodeResult, Geocoder } from '../../../domain/geocode/geocoder';
import { CsvSeeder } from '../../seed/csv-seeder';
import { buildDataSourceOptions, initializeWithRetry } from './data-source';
import { GeocodeCacheOrmEntity } from './entities/geocode-cache.orm-entity';
import { TypeOrmGeocodeCacheRepository } from './repositories/typeorm-geocode-cache.repository';
import { TypeOrmSpotRepository } from './repositories/typeorm-spot.repository';
import { readNumber, toRows } from './repositories/row-parsers';

/**
 * 実 PostGIS に対する統合テスト。生 SQL（マイグレーション・半径検索・upsert）を本物の DB で確かめる。
 * `npm run test:integration` でだけ実行する（通常の `npm test` からは jest.config で除外）。
 * 対象 DB の spots / geocode_cache / migrations テーブルを作り直すため、DB 名が `_test` で終わる場合だけ動かす。
 */
function resolveTestDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL?.trim();
  if (!url) throw new Error('TEST_DATABASE_URL is required for integration tests');
  const databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!databaseName.endsWith('_test')) {
    // 開発用・本番用の DB を誤って指定してテーブルを消さないためのガード
    throw new Error(`Refusing to run: database name must end with "_test" (got "${databaseName}")`);
  }
  return url;
}

const SEED_CSV_PATH = resolve(__dirname, '../../../../seed/spots.csv');
const TOKYO_STATION = { lat: 35.681236, lng: 139.767125 };

async function countSpots(dataSource: DataSource): Promise<number> {
  const result: unknown = await dataSource.query('SELECT count(*)::int AS count FROM spots');
  return readNumber(toRows(result)[0], 'count');
}

describe('TypeORM + PostGIS integration', () => {
  let dataSource: DataSource;
  let spots: TypeOrmSpotRepository;
  const silent = () => undefined;

  beforeAll(async () => {
    dataSource = await initializeWithRetry(buildDataSourceOptions(resolveTestDatabaseUrl()), {
      attempts: 5,
      intervalMs: 1000,
      log: silent,
    });
    await dataSource.query('DROP TABLE IF EXISTS spots, geocode_cache, migrations CASCADE');
    spots = new TypeOrmSpotRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  it('migration: 初回は InitSchema を適用し、2 回目は何もしない', async () => {
    const first = await dataSource.runMigrations({ transaction: 'each' });
    const second = await dataSource.runMigrations({ transaction: 'each' });

    expect(first.map((migration) => migration.name)).toEqual(['InitSchema1794182400000']);
    expect(second).toEqual([]);
  });

  it('seed: 1 回目は 200 件挿入、2 回目は何も変えない（冪等）', async () => {
    const seeder = new CsvSeeder(spots, silent);

    const first = await seeder.seedFromFile(SEED_CSV_PATH);
    const second = await seeder.seedFromFile(SEED_CSV_PATH);

    expect(first).toEqual({ total: 200, inserted: 200, updated: 0, unchanged: 0 });
    expect(second).toEqual({ total: 200, inserted: 0, updated: 0, unchanged: 200 });
    expect(await countSpots(dataSource)).toBe(200);
  });

  it('seed: 内容が変わった行だけ更新し、location 生成列も追従する', async () => {
    const original = { name: '東京駅', category: '交通機関', address: '東京都千代田区', ...TOKYO_STATION };

    const moved = await spots.upsertByName([{ ...original, lat: 35.0, lng: 135.0 }]);
    const nearOriginal = await spots.findWithinRadius({ center: TOKYO_STATION, radiusM: 100 });
    const restored = await spots.upsertByName([original]);

    expect(moved).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect(nearOriginal.map((spot) => spot.name)).not.toContain('東京駅');
    expect(restored).toEqual({ inserted: 0, updated: 1, unchanged: 0 });
    expect(await countSpots(dataSource)).toBe(200);
  });

  it('半径検索: 東京駅から 2km で東京駅・皇居の 2 件を距離昇順で返す', async () => {
    const found = await spots.findWithinRadius({ center: TOKYO_STATION, radiusM: 2000 });

    expect(found.map((spot) => spot.name)).toEqual(['東京駅', '皇居（江戸城跡）']);
    expect(found[0].distanceM).toBeCloseTo(0, 3);
    expect(found[1].distanceM).toBeGreaterThan(1300);
    expect(found[1].distanceM).toBeLessThan(1450);
    expect(found[0]).toMatchObject({ category: '交通機関', address: '東京都千代田区', ...TOKYO_STATION });
    expect(found[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('半径検索: category を完全一致で絞り込む', async () => {
    const stations = await spots.findWithinRadius({ center: TOKYO_STATION, radiusM: 2000, category: '交通機関' });
    const none = await spots.findWithinRadius({ center: TOKYO_STATION, radiusM: 2000, category: '交通' });

    expect(stations.map((spot) => spot.name)).toEqual(['東京駅']);
    expect(none).toEqual([]);
  });

  it('半径検索: SQL として解釈されうる category もパラメータとして扱う', async () => {
    const found = await spots.findWithinRadius({ center: TOKYO_STATION, radiusM: 2000, category: "' OR '1'='1" });

    expect(found).toEqual([]);
    expect(await countSpots(dataSource)).toBe(200);
  });

  it('カテゴリ一覧: 重複なしで 14 種を返す', async () => {
    const categories = await spots.listCategories();

    expect(categories).toHaveLength(14);
    expect(new Set(categories).size).toBe(14);
    expect(categories).toContain('観光名所');
  });

  it('geocode_cache: gridKey で upsert し、null 住所も往復できる', async () => {
    const cache = new TypeOrmGeocodeCacheRepository(dataSource.getRepository(GeocodeCacheOrmEntity));
    const base = { gridKey: '35.681:139.767', lat: 35.681, lng: 139.767, provider: 'gsi' as const };

    await cache.save({ ...base, address: null, fetchedAt: new Date('2026-10-01T00:00:00Z') });
    await cache.save({ ...base, address: '東京都千代田区丸の内一丁目', fetchedAt: new Date('2026-11-09T00:00:00Z') });
    await cache.save({ ...base, gridKey: '30.000:140.000', lat: 30, lng: 140, address: null, fetchedAt: new Date('2026-11-09T00:00:00Z') });

    expect(await cache.findByGridKey('35.681:139.767')).toEqual({
      ...base,
      address: '東京都千代田区丸の内一丁目',
      fetchedAt: new Date('2026-11-09T00:00:00Z'),
    });
    expect(await cache.findByGridKey('30.000:140.000')).toMatchObject({ address: null });
    expect(await cache.findByGridKey('0.000:0.000')).toBeNull();
  });

  it('ReverseGeocodeUseCase × 実キャッシュ: プロバイダが変わったら上書きし、失敗時は残っている行を返す', async () => {
    const cache = new TypeOrmGeocodeCacheRepository(dataSource.getRepository(GeocodeCacheOrmEntity));
    const options = { ttlDays: 30, gridDecimals: 3 };
    const now = () => new Date('2026-11-09T00:00:00Z');
    const geocoderReturning = (provider: 'google' | 'gsi', result: GeocodeResult): Geocoder => ({
      provider,
      reverse: () => Promise.resolve(result),
    });

    // キー無し（GSI）で保存 → Google に切り替えると TTL 内でも取り直して上書きする
    const gsi = new ReverseGeocodeUseCase(geocoderReturning('gsi', { kind: 'found', address: '丸の内二丁目', provider: 'gsi' }), cache, options, now);
    const google = new ReverseGeocodeUseCase(
      geocoderReturning('google', { kind: 'found', address: '東京都千代田区丸の内２丁目', provider: 'google' }),
      cache,
      options,
      now,
    );
    const googleDown = new ReverseGeocodeUseCase(
      geocoderReturning('google', { kind: 'unavailable', provider: 'google', reason: 'HTTP 503' }),
      cache,
      options,
      now,
    );
    const gsiDown = new ReverseGeocodeUseCase(
      geocoderReturning('gsi', { kind: 'unavailable', provider: 'gsi', reason: 'HTTP 503' }),
      cache,
      options,
      now,
    );

    await expect(gsi.execute(35.6801, 139.7671)).resolves.toMatchObject({ address: '丸の内二丁目', provider: 'gsi', cached: false });
    await expect(google.execute(35.6801, 139.7671)).resolves.toMatchObject({ provider: 'google', cached: false, status: 'found' });
    expect(await cache.findByGridKey('35.680:139.767')).toMatchObject({ provider: 'google', address: '東京都千代田区丸の内２丁目' });

    // GSI に戻した状態で GSI が落ちていても、Google の行を stale として返す（保存は変わらない）
    await expect(gsiDown.execute(35.6801, 139.7671)).resolves.toEqual({
      address: '東京都千代田区丸の内２丁目',
      provider: 'google',
      cached: true,
      gridKey: '35.680:139.767',
      status: 'found',
    });
    // 行が無いグリッドで失敗したら保存せず unavailable
    await expect(googleDown.execute(20.0, 150.0)).resolves.toMatchObject({ address: null, status: 'unavailable' });
    expect(await cache.findByGridKey('20.000:150.000')).toBeNull();
  });
});
