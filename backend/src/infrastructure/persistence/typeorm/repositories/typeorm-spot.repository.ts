import { DataSource } from 'typeorm';
import { NewSpot, SpotWithDistance } from '../../../../domain/spot/spot.entity';
import { SpotRepository, SpotSearchCriteria, UpsertResult } from '../../../../domain/spot/spot.repository';
import { readBoolean, readNumber, readString, toRows } from './row-parsers';

/**
 * 半径検索は PostGIS の関数を直接使うため生 SQL で書く（値はすべてプレースホルダでバインド）。
 * ST_DWithin は GiST インデックスで候補を絞り、ST_Distance で正確な距離を出す。
 */
const SEARCH_SQL = `
  WITH center AS (
    SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS point
  )
  SELECT s.id, s.name, s.category, s.address, s.lat, s.lng,
         ST_Distance(s.location, center.point) AS distance_m
    FROM spots s, center
   WHERE ST_DWithin(s.location, center.point, $3)
     AND ($4::text IS NULL OR s.category = $4::text)
   ORDER BY distance_m ASC, s.name ASC
`;

const CATEGORIES_SQL = 'SELECT DISTINCT category FROM spots ORDER BY category ASC';

const UPSERT_COLUMNS = ['name', 'category', 'address', 'lat', 'lng'] as const;

export class TypeOrmSpotRepository implements SpotRepository {
  constructor(private readonly dataSource: DataSource) {}

  async findWithinRadius(criteria: SpotSearchCriteria): Promise<SpotWithDistance[]> {
    const { center, radiusM, category } = criteria;
    const result: unknown = await this.dataSource.query(SEARCH_SQL, [
      center.lng,
      center.lat,
      radiusM,
      category ?? null,
    ]);
    return toRows(result).map((row) => ({
      id: readString(row, 'id'),
      name: readString(row, 'name'),
      category: readString(row, 'category'),
      address: readString(row, 'address'),
      lat: readNumber(row, 'lat'),
      lng: readNumber(row, 'lng'),
      distanceM: readNumber(row, 'distance_m'),
    }));
  }

  async listCategories(): Promise<string[]> {
    const result: unknown = await this.dataSource.query(CATEGORIES_SQL);
    return toRows(result).map((row) => readString(row, 'category'));
  }

  async upsertByName(spots: readonly NewSpot[]): Promise<UpsertResult> {
    if (spots.length === 0) return { inserted: 0, updated: 0, unchanged: 0 };

    const params: Array<string | number> = [];
    const tuples = spots.map((spot) => {
      const placeholders = UPSERT_COLUMNS.map((column) => {
        params.push(spot[column]);
        return `$${params.length}`;
      });
      return `(${placeholders.join(', ')})`;
    });

    // 内容が同じ行は WHERE で更新対象から外す（updated_at も動かさない）。再実行しても DB が何も変わらない。
    // RETURNING は挿入・更新された行だけを返し、xmax = 0 は「この文で新規挿入された行」を表す PostgreSQL の慣用句
    const sql = `
      INSERT INTO spots (${UPSERT_COLUMNS.join(', ')})
      VALUES ${tuples.join(', ')}
      ON CONFLICT (name) DO UPDATE SET
        category = EXCLUDED.category,
        address = EXCLUDED.address,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        updated_at = now()
      WHERE (spots.category, spots.address, spots.lat, spots.lng)
        IS DISTINCT FROM (EXCLUDED.category, EXCLUDED.address, EXCLUDED.lat, EXCLUDED.lng)
      RETURNING (xmax = 0) AS inserted
    `;
    const result: unknown = await this.dataSource.query(sql, params);
    const changed = toRows(result);
    const inserted = changed.filter((row) => readBoolean(row, 'inserted')).length;
    const updated = changed.length - inserted;
    return { inserted, updated, unchanged: spots.length - changed.length };
  }
}
