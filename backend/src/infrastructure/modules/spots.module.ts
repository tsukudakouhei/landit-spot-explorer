import { Module } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ListCategoriesUseCase } from '../../application/list-categories.usecase';
import { SearchSpotsUseCase } from '../../application/search-spots.usecase';
import { SPOT_REPOSITORY, SpotRepository } from '../../domain/spot/spot.repository';
import { SpotsController } from '../http/spots.controller';
import { TypeOrmSpotRepository } from '../persistence/typeorm/repositories/typeorm-spot.repository';

/**
 * DI の配線はこの層だけが知る。ユースケースは Nest のデコレータを持たない純クラスなので、
 * useFactory でポート（トークン）の実装を注入して生成する。
 */
@Module({
  controllers: [SpotsController],
  providers: [
    {
      provide: SPOT_REPOSITORY,
      inject: [getDataSourceToken()],
      useFactory: (dataSource: DataSource): SpotRepository => new TypeOrmSpotRepository(dataSource),
    },
    {
      provide: SearchSpotsUseCase,
      inject: [SPOT_REPOSITORY],
      useFactory: (spots: SpotRepository) => new SearchSpotsUseCase(spots),
    },
    {
      provide: ListCategoriesUseCase,
      inject: [SPOT_REPOSITORY],
      useFactory: (spots: SpotRepository) => new ListCategoriesUseCase(spots),
    },
  ],
})
export class SpotsModule {}
