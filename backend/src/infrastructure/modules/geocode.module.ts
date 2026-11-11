import { Logger, Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ReverseGeocodeUseCase } from '../../application/reverse-geocode.usecase';
import { GEOCODE_CACHE_REPOSITORY, GeocodeCacheRepository } from '../../domain/geocode/geocode-cache.repository';
import { GEOCODER, Geocoder } from '../../domain/geocode/geocoder';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { GoogleGeocoder } from '../geocoding/google-geocoder';
import { GsiGeocoder } from '../geocoding/gsi-geocoder';
import { GeocodeController } from '../http/geocode.controller';
import { GeocodeCacheOrmEntity } from '../persistence/typeorm/entities/geocode-cache.orm-entity';
import { TypeOrmGeocodeCacheRepository } from '../persistence/typeorm/repositories/typeorm-geocode-cache.repository';

/** API キーの有無で実装を切り替える。ユースケース側はどちらが来るかを知らない。 */
export function createGeocoder(config: AppConfig): Geocoder {
  const logger = new Logger('GeocoderFactory');
  if (config.googleGeocodingApiKey) {
    logger.log('Using GoogleGeocoder (GOOGLE_GEOCODING_API_KEY is set)');
    return new GoogleGeocoder(config.googleGeocodingApiKey);
  }
  logger.log('Using GsiGeocoder (GOOGLE_GEOCODING_API_KEY is empty)');
  return new GsiGeocoder();
}

@Module({
  controllers: [GeocodeController],
  providers: [
    { provide: GEOCODER, inject: [APP_CONFIG], useFactory: createGeocoder },
    {
      provide: GEOCODE_CACHE_REPOSITORY,
      inject: [getDataSourceToken()],
      useFactory: (dataSource: DataSource): GeocodeCacheRepository =>
        new TypeOrmGeocodeCacheRepository(dataSource.getRepository(GeocodeCacheOrmEntity)),
    },
    {
      provide: ReverseGeocodeUseCase,
      inject: [GEOCODER, GEOCODE_CACHE_REPOSITORY, APP_CONFIG],
      useFactory: (geocoder: Geocoder, cache: GeocodeCacheRepository, config: AppConfig) =>
        new ReverseGeocodeUseCase(geocoder, cache, {
          ttlDays: config.geocodeCacheTtlDays,
          gridDecimals: config.geocodeGridDecimals,
        }),
    },
  ],
})
export class GeocodeModule {}
