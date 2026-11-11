import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'node:http';
import request from 'supertest';
import { ListCategoriesUseCase } from '../../application/list-categories.usecase';
import { ReverseGeocodeUseCase } from '../../application/reverse-geocode.usecase';
import { SearchSpotsUseCase } from '../../application/search-spots.usecase';
import { GEOCODE_CACHE_REPOSITORY, GeocodeCacheRepository } from '../../domain/geocode/geocode-cache.repository';
import { GEOCODER, Geocoder } from '../../domain/geocode/geocoder';
import { SPOT_REPOSITORY, SpotRepository } from '../../domain/spot/spot.repository';
import { AppModule } from '../modules/app.module';
import { DatabaseModule } from '../modules/database.module';
import { configureApp } from './configure-app';
import { GeocodeController } from './geocode.controller';
import { HealthController } from './health.controller';
import { SpotsController } from './spots.controller';

/**
 * HTTP 層の結線テスト（DB 不要）。ユースケースはモックにし、
 * ルーティング・ValidationPipe・レスポンス形が契約どおりかを本物の Nest アプリで確かめる。
 */
describe('HTTP API (controllers + ValidationPipe)', () => {
  const CORS_ORIGIN = 'http://localhost:3000';
  const searchExecute = jest.fn();
  const categoriesExecute = jest.fn();
  const reverseExecute = jest.fn();
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController, SpotsController, GeocodeController],
      providers: [
        { provide: SearchSpotsUseCase, useValue: { execute: searchExecute } },
        { provide: ListCategoriesUseCase, useValue: { execute: categoriesExecute } },
        { provide: ReverseGeocodeUseCase, useValue: { execute: reverseExecute } },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { corsOrigin: CORS_ORIGIN });
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    searchExecute.mockReset();
    categoriesExecute.mockReset();
    reverseExecute.mockReset();
  });

  it('GET /health → 200 { status: "ok" }', async () => {
    const res = await request(server).get('/health').expect(200);

    expect(res.body).toEqual({ status: 'ok' });
  });

  describe('GET /spots/search', () => {
    const output = {
      items: [{ id: 'u1', name: '東京駅', category: '交通機関', address: '東京都千代田区', lat: 35.681236, lng: 139.767125, distanceM: 0 }],
      total: 1,
      center: { lat: 35.681236, lng: 139.767125 },
      radiusKm: 2,
    };

    it('クエリを数値に変換してユースケースに渡し、結果をそのまま返す（未知のパラメータは捨てる）', async () => {
      searchExecute.mockResolvedValue(output);

      const res = await request(server)
        .get('/spots/search')
        .query({ lat: '35.681236', lng: '139.767125', radiusKm: '2', category: '交通機関', foo: 'bar' })
        .expect(200);

      expect(searchExecute).toHaveBeenCalledTimes(1);
      expect(searchExecute).toHaveBeenCalledWith({ lat: 35.681236, lng: 139.767125, radiusKm: 2, category: '交通機関' });
      expect(res.body).toEqual(output);
    });

    it('category 未指定ならユースケースにも渡らない', async () => {
      searchExecute.mockResolvedValue({ ...output, items: [], total: 0 });

      await request(server).get('/spots/search').query({ lat: '35', lng: '139', radiusKm: '1' }).expect(200);

      expect(searchExecute).toHaveBeenCalledWith({ lat: 35, lng: 139, radiusKm: 1 });
    });

    it('不正な値は Nest 標準形式の 400（statusCode, message[]）で、ユースケースを呼ばない', async () => {
      const res = await request(server)
        .get('/spots/search')
        .query({ lat: '91', lng: '139', radiusKm: '0' })
        .expect(400);

      const body: unknown = res.body;
      expect(body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: expect.arrayContaining([expect.stringMatching(/^lat/), expect.stringMatching(/^radiusKm/)]) as unknown,
      });
      expect(searchExecute).not.toHaveBeenCalled();
    });

    it.each([
      ['空文字の lat', { lat: '', lng: '139', radiusKm: '1' }],
      ['16 進の lat', { lat: '0x10', lng: '139', radiusKm: '1' }],
      ['radiusKm が 50 超', { lat: '35', lng: '139', radiusKm: '51' }],
      ['必須パラメータ欠落', {}],
    ])('%s → 400', async (_label, query) => {
      await request(server).get('/spots/search').query(query).expect(400);

      expect(searchExecute).not.toHaveBeenCalled();
    });
  });

  it('GET /spots/categories → 200 { items }', async () => {
    categoriesExecute.mockResolvedValue({ items: ['交通機関', '公園'] });

    const res = await request(server).get('/spots/categories').expect(200);

    expect(res.body).toEqual({ items: ['交通機関', '公園'] });
  });

  describe('GET /geocode/reverse', () => {
    it('lat / lng を数値でユースケースに渡し、契約の形で返す', async () => {
      const output = { address: '東京都千代田区丸の内一丁目', provider: 'gsi', cached: false, gridKey: '35.681:139.767', status: 'found' };
      reverseExecute.mockResolvedValue(output);

      const res = await request(server).get('/geocode/reverse').query({ lat: '35.681236', lng: '139.767125' }).expect(200);

      expect(reverseExecute).toHaveBeenCalledWith(35.681236, 139.767125);
      expect(res.body).toEqual(output);
    });

    it('address が null でも 200', async () => {
      reverseExecute.mockResolvedValue({ address: null, provider: 'google', cached: true, gridKey: '30.000:140.000', status: 'not_found' });

      const res = await request(server).get('/geocode/reverse').query({ lat: '30', lng: '140' }).expect(200);

      expect(res.body).toMatchObject({ address: null, status: 'not_found' });
    });

    it('lng が範囲外なら 400', async () => {
      await request(server).get('/geocode/reverse').query({ lat: '35', lng: '181' }).expect(400);

      expect(reverseExecute).not.toHaveBeenCalled();
    });
  });

  it('CORS_ORIGIN を Access-Control-Allow-Origin に返す', async () => {
    const res = await request(server).get('/health').set('Origin', CORS_ORIGIN).expect(200);

    expect(res.headers['access-control-allow-origin']).toBe(CORS_ORIGIN);
  });
});

/** DB に接続しない空のモジュール。DatabaseModule（TypeOrmModule.forRootAsync）の代わりに差し込む。 */
@Module({})
class NoDatabaseModule {}

/**
 * 本番と同じ AppModule の配線（ユースケースの useFactory・トークン注入）を通す e2e。
 * 差し替えるのは外部 I/O の境界であるポート 3 つだけで、ユースケースは本物が動く。
 */
describe('AppModule wiring (ports overridden)', () => {
  const findWithinRadius = jest.fn<ReturnType<SpotRepository['findWithinRadius']>, Parameters<SpotRepository['findWithinRadius']>>();
  const reverse = jest.fn<ReturnType<Geocoder['reverse']>, Parameters<Geocoder['reverse']>>();
  const findByGridKey = jest.fn<ReturnType<GeocodeCacheRepository['findByGridKey']>, Parameters<GeocodeCacheRepository['findByGridKey']>>();
  const save = jest.fn<ReturnType<GeocodeCacheRepository['save']>, Parameters<GeocodeCacheRepository['save']>>();
  let app: INestApplication;
  let server: Server;

  beforeAll(async () => {
    const spotRepository: SpotRepository = {
      findWithinRadius,
      listCategories: jest.fn().mockResolvedValue(['交通機関']),
      upsertByName: jest.fn(),
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideModule(DatabaseModule)
      .useModule(NoDatabaseModule)
      .overrideProvider(SPOT_REPOSITORY)
      .useValue(spotRepository)
      .overrideProvider(GEOCODER)
      .useValue({ provider: 'gsi', reverse } satisfies Geocoder)
      .overrideProvider(GEOCODE_CACHE_REPOSITORY)
      .useValue({ findByGridKey, save } satisfies GeocodeCacheRepository)
      .compile();

    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app, { corsOrigin: 'http://localhost:3000' });
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /spots/search: 本物の SearchSpotsUseCase が km→m 換算・距離の丸めをしてポートを呼ぶ', async () => {
    findWithinRadius.mockResolvedValue([
      { id: 'u1', name: '東京駅', category: '交通機関', address: '東京都千代田区', lat: 35.681236, lng: 139.767125, distanceM: 12.345 },
    ]);

    const res = await request(server)
      .get('/spots/search')
      .query({ lat: '35.681236', lng: '139.767125', radiusKm: '1.5', category: '交通機関' })
      .expect(200);

    expect(findWithinRadius).toHaveBeenCalledWith({
      center: { lat: 35.681236, lng: 139.767125 },
      radiusM: 1500,
      category: '交通機関',
    });
    expect(res.body).toMatchObject({ total: 1, radiusKm: 1.5, items: [{ name: '東京駅', distanceM: 12.3 }] });
  });

  it('GET /geocode/reverse: 設定（既定 3 桁）で丸めた gridKey でキャッシュを引き、ミスなら Geocoder を呼んで保存する', async () => {
    findByGridKey.mockResolvedValue(null);
    reverse.mockResolvedValue({ kind: 'found', address: '東京都千代田区丸の内一丁目', provider: 'gsi' });
    save.mockResolvedValue(undefined);

    const res = await request(server).get('/geocode/reverse').query({ lat: '35.681236', lng: '139.767125' }).expect(200);

    expect(findByGridKey).toHaveBeenCalledWith('35.681:139.767');
    expect(reverse).toHaveBeenCalledWith(35.681, 139.767);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ gridKey: '35.681:139.767', address: '東京都千代田区丸の内一丁目' }));
    expect(res.body).toEqual({
      address: '東京都千代田区丸の内一丁目',
      provider: 'gsi',
      cached: false,
      gridKey: '35.681:139.767',
      status: 'found',
    });
  });

  it('GET /geocode/reverse: 外部 API 失敗かつキャッシュ無しなら 200 で status:unavailable（保存しない）', async () => {
    findByGridKey.mockResolvedValue(null);
    reverse.mockResolvedValue({ kind: 'unavailable', provider: 'gsi', reason: 'HTTP 503' });
    save.mockClear();

    const res = await request(server).get('/geocode/reverse').query({ lat: '30', lng: '140' }).expect(200);

    expect(save).not.toHaveBeenCalled();
    expect(res.body).toEqual({ address: null, provider: 'gsi', cached: false, gridKey: '30.000:140.000', status: 'unavailable' });
  });

  it('GET /health と GET /spots/categories も AppModule 経由で応答する', async () => {
    await request(server).get('/health').expect(200, { status: 'ok' });
    await request(server).get('/spots/categories').expect(200, { items: ['交通機関'] });
  });
});
