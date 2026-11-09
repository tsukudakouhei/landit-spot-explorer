import { GeocodeCacheEntry, GeocodeCacheRepository } from '../domain/geocode/geocode-cache.repository';
import { GeocodeProvider, Geocoder } from '../domain/geocode/geocoder';
import { roundCoordinate, toGridKey } from '../domain/geocode/grid-key';

export interface ReverseGeocodeOptions {
  readonly ttlDays: number;
  readonly gridDecimals: number;
}

/**
 * - found:       住所あり
 * - not_found:   住所が無い地点（海上など）
 * - unavailable: 外部 API の失敗で取得できず、使えるキャッシュも無い
 * address が null のとき、フロントは status で「住所が無い」と「取得できなかった」を区別できる。
 */
export type ReverseGeocodeStatus = 'found' | 'not_found' | 'unavailable';

export interface ReverseGeocodeOutput {
  readonly address: string | null;
  readonly provider: GeocodeProvider;
  readonly cached: boolean;
  readonly gridKey: string;
  readonly status: ReverseGeocodeStatus;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class ReverseGeocodeUseCase {
  constructor(
    private readonly geocoder: Geocoder,
    private readonly cache: GeocodeCacheRepository,
    private readonly options: ReverseGeocodeOptions,
    // テストで時刻を固定できるよう現在時刻は注入する
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute(lat: number, lng: number): Promise<ReverseGeocodeOutput> {
    const { gridDecimals } = this.options;
    const gridKey = toGridKey(lat, lng, gridDecimals);
    const now = this.now();

    const hit = await this.cache.findByGridKey(gridKey);
    if (hit && this.isUsable(hit, now)) {
      return fromCache(hit);
    }

    // グリッド中心で問い合わせることで、キャッシュの値がそのグリッドを代表するようにする
    const gridLat = roundCoordinate(lat, gridDecimals);
    const gridLng = roundCoordinate(lng, gridDecimals);
    const result = await this.geocoder.reverse(gridLat, gridLng);

    let address: string | null;
    switch (result.kind) {
      case 'unavailable':
        // stale-if-error: 期限切れ・別プロバイダの行でも、何も無いよりは役に立つので返す（保存はしない）
        if (hit) return fromCache(hit);
        // 一時的な失敗を保存すると TTL の間ずっと null が返り続けるため、保存しない
        return { address: null, provider: result.provider, cached: false, gridKey, status: 'unavailable' };
      case 'found':
        address = result.address;
        break;
      case 'not_found':
        address = null;
        break;
      default: {
        // 結果の種類が増えたらここでコンパイルエラーにする（扱い忘れを型で防ぐ）
        const _exhaustive: never = result;
        throw new Error(`Unhandled geocode result: ${JSON.stringify(_exhaustive)}`);
      }
    }

    // not_found（海上など）も保存する。特定できない地点を何度も外部 API に問い合わせないため
    await this.cache.save({
      gridKey,
      lat: gridLat,
      lng: gridLng,
      address,
      provider: result.provider,
      fetchedAt: now,
    });

    return { address, provider: result.provider, cached: false, gridKey, status: result.kind };
  }

  /**
   * TTL 内で、かつ今のジオコーダと同じプロバイダが保存した行だけを使う。
   * キー無し（GSI）で溜めた粗い住所が、Google キー設定後も TTL の間返り続けるのを防ぐため。
   */
  private isUsable(entry: GeocodeCacheEntry, now: Date): boolean {
    const fresh = now.getTime() - entry.fetchedAt.getTime() < this.options.ttlDays * MS_PER_DAY;
    return fresh && entry.provider === this.geocoder.provider;
  }
}

function fromCache(entry: GeocodeCacheEntry): ReverseGeocodeOutput {
  return {
    address: entry.address,
    provider: entry.provider,
    cached: true,
    gridKey: entry.gridKey,
    status: entry.address === null ? 'not_found' : 'found',
  };
}
