import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_CONFIG, AppConfig } from '../config/app-config';
import { buildDataSourceOptions } from '../persistence/typeorm/data-source';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        ...buildDataSourceOptions(config.databaseUrl),
        // 起動スクリプトと同じく、DB の起動待ちを 2 秒間隔 × 最大 30 回まで許容する
        retryAttempts: 30,
        retryDelay: 2000,
      }),
    }),
  ],
})
export class DatabaseModule {}
