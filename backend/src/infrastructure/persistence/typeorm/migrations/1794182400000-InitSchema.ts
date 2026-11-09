import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 生成列（GENERATED ALWAYS AS ... STORED）と GiST インデックスは TypeORM のデコレータで
 * 表現しきれないため、契約どおりの DDL を生 SQL で書く。
 */
export class InitSchema1794182400000 implements MigrationInterface {
  name = 'InitSchema1794182400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
    await queryRunner.query(`
      CREATE TABLE spots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        category text NOT NULL,
        address text NOT NULL,
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        location geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX spots_location_gist ON spots USING GIST (location)`);
    await queryRunner.query(`CREATE INDEX spots_category_idx ON spots (category)`);
    await queryRunner.query(`
      CREATE TABLE geocode_cache (
        grid_key text PRIMARY KEY,
        lat double precision NOT NULL,
        lng double precision NOT NULL,
        formatted_address text NULL,
        provider text NOT NULL,
        fetched_at timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS geocode_cache`);
    await queryRunner.query(`DROP TABLE IF EXISTS spots`);
    // postgis 拡張は他の用途で使われている可能性があるため down では消さない
  }
}
