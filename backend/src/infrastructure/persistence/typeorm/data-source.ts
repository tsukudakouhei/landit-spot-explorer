import { DataSource, DataSourceOptions } from 'typeorm';
import { GeocodeCacheOrmEntity } from './entities/geocode-cache.orm-entity';
import { SpotOrmEntity } from './entities/spot.orm-entity';
import { InitSchema1794182400000 } from './migrations/1794182400000-InitSchema';

export const ORM_ENTITIES = [SpotOrmEntity, GeocodeCacheOrmEntity];
// glob ではなくクラスを列挙する: ts-node（開発）と dist（本番）のどちらでも同じ設定で動くため
export const MIGRATIONS = [InitSchema1794182400000];

/** Nest アプリ・マイグレーション CLI・シード CLI で共有する接続設定。 */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: ORM_ENTITIES,
    migrations: MIGRATIONS,
    // スキーマはマイグレーションだけで管理する（生成列を ORM に壊させない）
    synchronize: false,
    migrationsRun: false,
  };
}

export interface RetryOptions {
  readonly attempts: number;
  readonly intervalMs: number;
  readonly log: (message: string) => void;
}

const DEFAULT_RETRY: RetryOptions = {
  attempts: 30,
  intervalMs: 2000,
  log: (message) => console.log(message),
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** DB コンテナの起動待ち。healthcheck をすり抜けた直後の接続拒否にも耐えるよう、一定間隔で再試行する。 */
export async function initializeWithRetry(
  options: DataSourceOptions,
  retry: Partial<RetryOptions> = {},
): Promise<DataSource> {
  const { attempts, intervalMs, log } = { ...DEFAULT_RETRY, ...retry };
  for (let attempt = 1; ; attempt++) {
    const dataSource = new DataSource(options);
    try {
      return await dataSource.initialize();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      if (attempt >= attempts) {
        throw new Error(`Database connection failed after ${attempts} attempts: ${reason}`);
      }
      log(`Database not ready (attempt ${attempt}/${attempts}): ${reason}. Retrying in ${intervalMs}ms...`);
      await sleep(intervalMs);
    }
  }
}
