import { INestApplication, ValidationPipe } from '@nestjs/common';

/** main.ts と HTTP テストで同じ設定を使うために切り出す（テストだけ別設定、を防ぐ）。 */
export function configureApp(app: INestApplication, options: { corsOrigin: string }): void {
  app.enableCors({ origin: options.corsOrigin });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true, // DTO クラスのインスタンスに変換し、@ToNumber 等の変換を効かせる
      whitelist: true, // DTO に無いクエリは捨てる
    }),
  );
}
