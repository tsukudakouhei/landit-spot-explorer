import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { APP_CONFIG, AppConfig } from './infrastructure/config/app-config';
import { configureApp } from './infrastructure/http/configure-app';
import { AppModule } from './infrastructure/modules/app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);

  configureApp(app, { corsOrigin: config.corsOrigin });
  app.enableShutdownHooks();

  // host を省略してデュアルスタック（::）で待ち受ける。'0.0.0.0' だと IPv4 のみになり、
  // コンテナ内で localhost が ::1 に解決される healthcheck が接続拒否になる
  await app.listen(config.port);
  Logger.log(`API listening on port ${config.port}`, 'Bootstrap');
}

void bootstrap();
