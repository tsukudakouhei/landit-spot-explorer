import { GeocodeCacheEntry, GeocodeCacheRepository } from '../domain/geocode/geocode-cache.repository';
import { GeocodeProvider, GeocodeResult, Geocoder } from '../domain/geocode/geocoder';
import { ReverseGeocodeUseCase } from './reverse-geocode.usecase';

const NOW = new Date('2026-11-09T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const OPTIONS = { ttlDays: 30, gridDecimals: 3 };
const GRID_KEY = '35.681:139.767';
const ADDRESS = '東京都千代田区丸の内一丁目';

function setup(
  cached: GeocodeCacheEntry | null,
  options: { provider?: GeocodeProvider; result?: GeocodeResult } = {},
) {
  const provider = options.provider ?? 'gsi';
  const geocoded: GeocodeResult = options.result ?? { kind: 'found', address: ADDRESS, provider };
  const reverse = jest.fn<Promise<GeocodeResult>, [number, number]>().mockResolvedValue(geocoded);
  const findByGridKey = jest.fn<Promise<GeocodeCacheEntry | null>, [string]>().mockResolvedValue(cached);
  const save = jest.fn<Promise<void>, [GeocodeCacheEntry]>().mockResolvedValue(undefined);
  const geocoder: Geocoder = { provider, reverse };
  const cache: GeocodeCacheRepository = { findByGridKey, save };
  const useCase = new ReverseGeocodeUseCase(geocoder, cache, OPTIONS, () => NOW);
  return { useCase, reverse, findByGridKey, save };
}

/** 既定は「今のジオコーダ（gsi）が 1 日前に保存した行」。 */
function cacheEntry(ageMs: number, overrides: Partial<GeocodeCacheEntry> = {}): GeocodeCacheEntry {
  return {
    gridKey: GRID_KEY,
    lat: 35.681,
    lng: 139.767,
    address: ADDRESS,
    provider: 'gsi',
    fetchedAt: new Date(NOW.getTime() - ageMs),
    ...overrides,
  };
}

const unavailable = (provider: GeocodeProvider): GeocodeResult => ({ kind: 'unavailable', provider, reason: 'HTTP 503' });

describe('ReverseGeocodeUseCase', () => {
  it('座標を丸めた gridKey でキャッシュを引く', async () => {
    const { useCase, findByGridKey } = setup(null);

    await useCase.execute(35.681236, 139.767125);

    expect(findByGridKey).toHaveBeenCalledWith(GRID_KEY);
  });

  describe('キャッシュが使える（TTL 内・同じプロバイダ）', () => {
    it('Geocoder を呼ばず cached:true・status:found で返す', async () => {
      const { useCase, reverse, save } = setup(cacheEntry(29 * DAY));

      const result = await useCase.execute(35.681236, 139.767125);

      expect(reverse).not.toHaveBeenCalled();
      expect(save).not.toHaveBeenCalled();
      expect(result).toEqual({ address: ADDRESS, provider: 'gsi', cached: true, gridKey: GRID_KEY, status: 'found' });
    });

    it('address が null の行もヒットとして status:not_found で返す（海上を何度も問い合わせない）', async () => {
      const { useCase, reverse } = setup(cacheEntry(DAY, { address: null }));

      const result = await useCase.execute(35.681236, 139.767125);

      expect(reverse).not.toHaveBeenCalled();
      expect(result).toEqual({ address: null, provider: 'gsi', cached: true, gridKey: GRID_KEY, status: 'not_found' });
    });
  });

  describe('キャッシュが使えない → 取り直して upsert', () => {
    it('ミスならグリッド座標で Geocoder を呼び、保存して cached:false・status:found', async () => {
      const { useCase, reverse, save } = setup(null);

      const result = await useCase.execute(35.681236, 139.767125);

      expect(reverse).toHaveBeenCalledWith(35.681, 139.767);
      expect(save).toHaveBeenCalledWith({
        gridKey: GRID_KEY,
        lat: 35.681,
        lng: 139.767,
        address: ADDRESS,
        provider: 'gsi',
        fetchedAt: NOW,
      });
      expect(result).toEqual({ address: ADDRESS, provider: 'gsi', cached: false, gridKey: GRID_KEY, status: 'found' });
    });

    it('TTL 切れ（ちょうど 30 日）なら取り直して上書きする', async () => {
      const { useCase, reverse, save } = setup(cacheEntry(30 * DAY, { address: '古い住所' }));

      const result = await useCase.execute(35.681236, 139.767125);

      expect(reverse).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ address: ADDRESS, fetchedAt: NOW }));
      expect(result).toMatchObject({ address: ADDRESS, cached: false, status: 'found' });
    });

    it('TTL 内でも保存時と今のプロバイダが違えば取り直す（GSI で溜めた住所を Google 設定後に使い続けない）', async () => {
      const { useCase, reverse, save } = setup(cacheEntry(DAY, { provider: 'gsi', address: '丸の内一丁目' }), {
        provider: 'google',
        result: { kind: 'found', address: '東京都千代田区丸の内１丁目', provider: 'google' },
      });

      const result = await useCase.execute(35.681236, 139.767125);

      expect(reverse).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ provider: 'google', address: '東京都千代田区丸の内１丁目' }));
      expect(result).toEqual({
        address: '東京都千代田区丸の内１丁目',
        provider: 'google',
        cached: false,
        gridKey: GRID_KEY,
        status: 'found',
      });
    });

    it('not_found（海上など）は address:null で保存し、cached:false・status:not_found', async () => {
      const { useCase, save } = setup(null, { provider: 'google', result: { kind: 'not_found', provider: 'google' } });

      const result = await useCase.execute(30.0, 140.0);

      expect(save).toHaveBeenCalledWith(expect.objectContaining({ gridKey: '30.000:140.000', address: null, provider: 'google' }));
      expect(result).toEqual({ address: null, provider: 'google', cached: false, gridKey: '30.000:140.000', status: 'not_found' });
    });
  });

  describe('取り直しが unavailable（外部 API の失敗）', () => {
    it('行が無ければ保存せず address:null・cached:false・status:unavailable', async () => {
      const { useCase, save } = setup(null, { provider: 'google', result: unavailable('google') });

      const result = await useCase.execute(35.681236, 139.767125);

      expect(save).not.toHaveBeenCalled();
      expect(result).toEqual({ address: null, provider: 'google', cached: false, gridKey: GRID_KEY, status: 'unavailable' });
    });

    it('stale-if-error: 期限切れの行があればその住所を cached:true で返す（保存しない）', async () => {
      const { useCase, save } = setup(cacheEntry(31 * DAY, { address: '古い住所' }), { result: unavailable('gsi') });

      const result = await useCase.execute(35.681236, 139.767125);

      expect(save).not.toHaveBeenCalled();
      expect(result).toEqual({ address: '古い住所', provider: 'gsi', cached: true, gridKey: GRID_KEY, status: 'found' });
    });

    it('stale-if-error: 別プロバイダの行でも返す。provider は保存時のもの', async () => {
      const { useCase, save } = setup(cacheEntry(DAY, { provider: 'gsi', address: '丸の内一丁目' }), {
        provider: 'google',
        result: unavailable('google'),
      });

      const result = await useCase.execute(35.681236, 139.767125);

      expect(save).not.toHaveBeenCalled();
      expect(result).toEqual({ address: '丸の内一丁目', provider: 'gsi', cached: true, gridKey: GRID_KEY, status: 'found' });
    });

    it('stale-if-error: 期限切れの not_found 行なら status:not_found', async () => {
      const { useCase } = setup(cacheEntry(31 * DAY, { address: null }), { result: unavailable('gsi') });

      await expect(useCase.execute(35.681236, 139.767125)).resolves.toMatchObject({
        address: null,
        cached: true,
        status: 'not_found',
      });
    });

    it('失敗は保存されないので、次のリクエストでは再び Geocoder に問い合わせる', async () => {
      const { useCase, reverse, save } = setup(null);
      reverse.mockResolvedValueOnce(unavailable('gsi'));

      const first = await useCase.execute(35.681236, 139.767125);
      const second = await useCase.execute(35.681236, 139.767125);

      expect(reverse).toHaveBeenCalledTimes(2);
      expect(first.status).toBe('unavailable');
      expect(second).toMatchObject({ address: ADDRESS, cached: false, status: 'found' });
      expect(save).toHaveBeenCalledTimes(1);
    });
  });

  it('同じグリッド内の微小な移動は同じキーになる', async () => {
    const { useCase, findByGridKey } = setup(null);

    await useCase.execute(35.6811, 139.7671);
    await useCase.execute(35.68149, 139.76651);

    expect(findByGridKey.mock.calls.map(([key]) => key)).toEqual([GRID_KEY, GRID_KEY]);
  });
});
