import 'reflect-metadata';
import { loadConfig } from '../config/app-config';
import { buildDataSourceOptions, initializeWithRetry } from '../persistence/typeorm/data-source';

/** `npm run migration:run` / コンテナ起動時に実行。未適用のマイグレーションだけを流す。 */
async function main(): Promise<void> {
  const config = loadConfig();
  const dataSource = await initializeWithRetry(buildDataSourceOptions(config.databaseUrl));
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length === 0
        ? 'No pending migrations.'
        : `Applied migrations: ${applied.map((migration) => migration.name).join(', ')}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
