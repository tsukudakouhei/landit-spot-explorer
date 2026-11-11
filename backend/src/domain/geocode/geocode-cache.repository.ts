import { GeocodeProvider } from './geocoder';

export interface GeocodeCacheEntry {
  readonly gridKey: string;
  /** グリッドに丸めた緯度経度。 */
  readonly lat: number;
  readonly lng: number;
  readonly address: string | null;
  readonly provider: GeocodeProvider;
  readonly fetchedAt: Date;
}

export const GEOCODE_CACHE_REPOSITORY = Symbol('GEOCODE_CACHE_REPOSITORY');

export interface GeocodeCacheRepository {
  findByGridKey(gridKey: string): Promise<GeocodeCacheEntry | null>;
  /** gridKey をキーに upsert する。 */
  save(entry: GeocodeCacheEntry): Promise<void>;
}
