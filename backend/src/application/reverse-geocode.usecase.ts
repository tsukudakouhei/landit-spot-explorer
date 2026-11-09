import { GeocodeCacheEntry, GeocodeCacheRepository } from '../domain/geocode/geocode-cache.repository';
import { GeocodeProvider, Geocoder } from '../domain/geocode/geocoder';
import { roundCoordinate, toGridKey } from '../domain/geocode/grid-key';

export interface ReverseGeocodeOptions {
  readonly ttlDays: number;
  readonly gridDecimals: number;
}

export interface ReverseGeocodeOutput {
  readonly address: string | null;
  readonly provider: GeocodeProvider;
  readonly cached: boolean;
  readonly gridKey: string;
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
    if (hit && this.isFresh(hit, now)) {
      return { address: hit.address, provider: hit.provider, cached: true, gridKey };
    }

    // グリッド中心で問い合わせることで、キャッシュの値がそのグリッドを代表するようにする
    const gridLat = roundCoordinate(lat, gridDecimals);
    const gridLng = roundCoordinate(lng, gridDecimals);
    const result = await this.geocoder.reverse(gridLat, gridLng);

    let address: string | null;
    switch (result.kind) {
      case 'unavailable':
        // 一時的な失敗を保存すると TTL の間ずっと null が返り続けるため、保存せずその場だけ null を返す
        return { address: null, provider: result.provider, cached: false, gridKey };
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

    return { address, provider: result.provider, cached: false, gridKey };
  }

  private isFresh(entry: GeocodeCacheEntry, now: Date): boolean {
    return now.getTime() - entry.fetchedAt.getTime() < this.options.ttlDays * MS_PER_DAY;
  }
}
