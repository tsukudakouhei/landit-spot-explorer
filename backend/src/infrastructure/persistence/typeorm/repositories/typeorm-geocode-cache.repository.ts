import { Repository } from 'typeorm';
import { GeocodeCacheEntry, GeocodeCacheRepository } from '../../../../domain/geocode/geocode-cache.repository';
import { GeocodeProvider } from '../../../../domain/geocode/geocoder';
import { GeocodeCacheOrmEntity } from '../entities/geocode-cache.orm-entity';

function toProvider(value: string): GeocodeProvider {
  if (value === 'google' || value === 'gsi') return value;
  throw new TypeError(`Unknown geocode provider in cache: ${value}`);
}

export class TypeOrmGeocodeCacheRepository implements GeocodeCacheRepository {
  constructor(private readonly repository: Repository<GeocodeCacheOrmEntity>) {}

  async findByGridKey(gridKey: string): Promise<GeocodeCacheEntry | null> {
    const row = await this.repository.findOneBy({ gridKey });
    if (!row) return null;
    return {
      gridKey: row.gridKey,
      lat: row.lat,
      lng: row.lng,
      address: row.formattedAddress,
      provider: toProvider(row.provider),
      fetchedAt: row.fetchedAt,
    };
  }

  async save(entry: GeocodeCacheEntry): Promise<void> {
    // 同じグリッドへの同時リクエストでも PK 衝突しないよう upsert（INSERT ... ON CONFLICT）にする
    await this.repository.upsert(
      {
        gridKey: entry.gridKey,
        lat: entry.lat,
        lng: entry.lng,
        formattedAddress: entry.address,
        provider: entry.provider,
        fetchedAt: entry.fetchedAt,
      },
      ['gridKey'],
    );
  }
}
