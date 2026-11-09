import { GeocodeCacheEntry, GeocodeCacheRepository } from '../domain/geocode/geocode-cache.repository';
import { GeocodeResult, Geocoder } from '../domain/geocode/geocoder';
import { ReverseGeocodeUseCase } from './reverse-geocode.usecase';

const NOW = new Date('2026-11-09T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const OPTIONS = { ttlDays: 30, gridDecimals: 3 };

function setup(
  cached: GeocodeCacheEntry | null,
  geocoded: GeocodeResult = { kind: 'found', address: '東京都千代田区丸の内一丁目', provider: 'gsi' },
) {
  const reverse = jest.fn<Promise<GeocodeResult>, [number, number]>().mockResolvedValue(geocoded);
  const findByGridKey = jest.fn<Promise<GeocodeCacheEntry | null>, [string]>().mockResolvedValue(cached);
  const save = jest.fn<Promise<void>, [GeocodeCacheEntry]>().mockResolvedValue(undefined);
  const geocoder: Geocoder = { reverse };
  const cache: GeocodeCacheRepository = { findByGridKey, save };
  const useCase = new ReverseGeocodeUseCase(geocoder, cache, OPTIONS, () => NOW);
  return { useCase, reverse, findByGridKey, save };
}

function cacheEntry(ageMs: number, overrides: Partial<GeocodeCacheEntry> = {}): GeocodeCacheEntry {
  return {
    gridKey: '35.681:139.767',
    lat: 35.681,
    lng: 139.767,
    address: '東京都千代田区丸の内一丁目',
    provider: 'google',
    fetchedAt: new Date(NOW.getTime() - ageMs),
    ...overrides,
  };
}

describe('ReverseGeocodeUseCase', () => {
  it('座標を丸めた gridKey でキャッシュを引く', async () => {
    const { useCase, findByGridKey } = setup(null);

    await useCase.execute(35.681236, 139.767125);

    expect(findByGridKey).toHaveBeenCalledWith('35.681:139.767');
  });

  it('TTL 内のキャッシュがあれば Geocoder を呼ばず cached:true で返す', async () => {
    const { useCase, reverse, save } = setup(cacheEntry(29 * DAY));

    const result = await useCase.execute(35.681236, 139.767125);

    expect(reverse).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({
      address: '東京都千代田区丸の内一丁目',
      provider: 'google', // キャッシュ時点のプロバイダをそのまま返す
      cached: true,
      gridKey: '35.681:139.767',
    });
  });

  it('address が null のキャッシュもヒットとして扱う（海上を何度も問い合わせない）', async () => {
    const { useCase, reverse } = setup(cacheEntry(DAY, { address: null }));

    const result = await useCase.execute(35.681236, 139.767125);

    expect(reverse).not.toHaveBeenCalled();
    expect(result).toMatchObject({ address: null, cached: true });
  });

  it('TTL 切れ（ちょうど 30 日）のキャッシュは Geocoder を呼び直して上書きする', async () => {
    const { useCase, reverse, save } = setup(cacheEntry(30 * DAY, { address: '古い住所' }));

    const result = await useCase.execute(35.681236, 139.767125);

    expect(reverse).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ address: '東京都千代田区丸の内一丁目', fetchedAt: NOW }));
    expect(result).toEqual({ address: '東京都千代田区丸の内一丁目', provider: 'gsi', cached: false, gridKey: '35.681:139.767' });
  });

  it('キャッシュミスならグリッド座標で Geocoder を呼び、結果を保存して cached:false で返す', async () => {
    const { useCase, reverse, save } = setup(null);

    const result = await useCase.execute(35.681236, 139.767125);

    expect(reverse).toHaveBeenCalledWith(35.681, 139.767);
    expect(save).toHaveBeenCalledWith({
      gridKey: '35.681:139.767',
      lat: 35.681,
      lng: 139.767,
      address: '東京都千代田区丸の内一丁目',
      provider: 'gsi',
      fetchedAt: NOW,
    });
    expect(result.cached).toBe(false);
  });

  it('not_found（海上など）は address:null として保存し、200 用の値を返す', async () => {
    const { useCase, save } = setup(null, { kind: 'not_found', provider: 'google' });

    const result = await useCase.execute(30.0, 140.0);

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ gridKey: '30.000:140.000', address: null, provider: 'google' }));
    expect(result).toEqual({ address: null, provider: 'google', cached: false, gridKey: '30.000:140.000' });
  });

  it('unavailable（取得失敗）は保存せず、その場だけ address:null を返す', async () => {
    const { useCase, save } = setup(null, { kind: 'unavailable', provider: 'google', reason: 'status REQUEST_DENIED' });

    const result = await useCase.execute(35.681236, 139.767125);

    expect(save).not.toHaveBeenCalled();
    expect(result).toEqual({ address: null, provider: 'google', cached: false, gridKey: '35.681:139.767' });
  });

  it('unavailable の後、次のリクエストでは再び Geocoder に問い合わせる（失敗を固定化しない）', async () => {
    const { useCase, reverse, save } = setup(null);
    reverse.mockResolvedValueOnce({ kind: 'unavailable', provider: 'gsi', reason: 'HTTP 503' });

    const first = await useCase.execute(35.681236, 139.767125);
    const second = await useCase.execute(35.681236, 139.767125);

    expect(reverse).toHaveBeenCalledTimes(2);
    expect(first.address).toBeNull();
    expect(second).toMatchObject({ address: '東京都千代田区丸の内一丁目', cached: false });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('期限切れの行があっても unavailable なら古い住所は返さず null（stale-if-error は未対応）', async () => {
    const { useCase, save } = setup(cacheEntry(31 * DAY, { address: '古い住所' }), {
      kind: 'unavailable',
      provider: 'gsi',
      reason: 'HTTP 503',
    });

    const result = await useCase.execute(35.681236, 139.767125);

    expect(result).toEqual({ address: null, provider: 'gsi', cached: false, gridKey: '35.681:139.767' });
    expect(save).not.toHaveBeenCalled();
  });

  it('同じグリッド内の微小な移動は同じキーになる', async () => {
    const { useCase, findByGridKey } = setup(null);

    await useCase.execute(35.68110, 139.76710);
    await useCase.execute(35.68149, 139.76651);

    expect(findByGridKey.mock.calls.map(([key]) => key)).toEqual(['35.681:139.767', '35.681:139.767']);
  });
});
