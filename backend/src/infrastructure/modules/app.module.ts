import { Module } from '@nestjs/common';
import { HealthController } from '../http/health.controller';
import { ConfigModule } from './config.module';
import { DatabaseModule } from './database.module';
import { GeocodeModule } from './geocode.module';
import { SpotsModule } from './spots.module';

@Module({
  imports: [ConfigModule, DatabaseModule, SpotsModule, GeocodeModule],
  controllers: [HealthController],
})
export class AppModule {}
