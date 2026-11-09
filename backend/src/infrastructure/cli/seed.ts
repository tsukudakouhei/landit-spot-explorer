import 'reflect-metadata';
import { resolve } from 'node:path';
import { loadConfig } from '../config/app-config';
import { buildDataSourceOptions, initializeWithRetry } from '../persistence/typeorm/data-source';
import { TypeOrmSpotRepository } from '../persistence/typeorm/repositories/typeorm-spot.repository';
import { CsvSeeder } from '../seed/csv-seeder';

// src/infrastructure/cli（ts-node）と dist/infrastructure/cli（本番）のどちらからでも backend/seed を指す
const SEED_CSV_PATH = resolve(__dirname, '../../../seed/spots.csv');

/** `npm run seed` / コンテナ起動時に実行。spots.csv を name キーで冪等 upsert する。 */
async function main(): Promise<void> {
  const config = loadConfig();
  const dataSource = await initializeWithRetry(buildDataSourceOptions(config.databaseUrl));
  try {
    await new CsvSeeder(new TypeOrmSpotRepository(dataSource)).seedFromFile(SEED_CSV_PATH);
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
