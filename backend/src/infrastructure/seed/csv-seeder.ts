import { readFile } from 'node:fs/promises';
import { createNewSpot, NewSpot } from '../../domain/spot/spot.entity';
import { SpotRepository, UpsertResult } from '../../domain/spot/spot.repository';

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

export interface CsvSpotRow {
  readonly name: string;
  readonly category: string;
  readonly address: string;
  readonly lat: number;
  readonly lng: number;
  /** エラー表示用の行番号（1 始まり、ヘッダ行を含む）。 */
  readonly line: number;
}

const REQUIRED_COLUMNS = ['name', 'category', 'lat', 'long', 'address'] as const;
type Column = (typeof REQUIRED_COLUMNS)[number];

/** 1 行を列に分割する。ダブルクォートで囲まれた列（カンマ・"" エスケープを含む）にも対応する。 */
function splitCsvLine(line: string, lineNo: number): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (inQuotes) {
    // 引用符内の改行は未対応（1 行 1 レコード前提）。黙って列をずらさず、行番号付きで止める
    throw new CsvParseError(`line ${lineNo}: unclosed double quote`);
  }
  fields.push(current);
  return fields.map((field) => field.trim());
}

function toNumber(raw: string, column: Column, line: number): number {
  const value = raw === '' ? Number.NaN : Number(raw);
  if (!Number.isFinite(value)) {
    throw new CsvParseError(`line ${line}: column "${column}" is not a number: "${raw}"`);
  }
  return value;
}

/**
 * spots.csv（列: name,category,lat,long,address）をパースする。
 * CSV の `long` 列はドメインの `lng` に読み替える。空行は無視する。
 */
export function parseSpotsCsv(text: string): CsvSpotRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim() !== '');
  if (headerIndex === -1) return [];

  const header = splitCsvLine(lines[headerIndex], headerIndex + 1);
  const indexOf = Object.fromEntries(
    REQUIRED_COLUMNS.map((column) => {
      const index = header.indexOf(column);
      if (index === -1) throw new CsvParseError(`missing required column "${column}" in header`);
      return [column, index];
    }),
  ) as Record<Column, number>;

  const rows: CsvSpotRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const lineNo = i + 1;
    const fields = splitCsvLine(lines[i], lineNo);
    // 多すぎる列も、引用符漏れのカンマなどで値がずれている兆候なのでエラーにする
    if (fields.length !== header.length) {
      throw new CsvParseError(`line ${lineNo}: expected ${header.length} columns but got ${fields.length}`);
    }
    const get = (column: Column) => fields[indexOf[column]];
    rows.push({
      name: get('name'),
      category: get('category'),
      address: get('address'),
      lat: toNumber(get('lat'), 'lat', lineNo),
      lng: toNumber(get('long'), 'long', lineNo),
      line: lineNo,
    });
  }
  return rows;
}

export interface SeedReport extends UpsertResult {
  readonly total: number;
}

/**
 * CSV を読み、ドメインの検証（createNewSpot）を通してから name キーで upsert する。
 * 何度実行しても件数は増えない（冪等）ため、コンテナ起動のたびに実行してよい。
 */
export class CsvSeeder {
  constructor(
    private readonly spots: SpotRepository,
    private readonly log: (message: string) => void = (message) => console.log(message),
  ) {}

  async seedFromFile(filePath: string): Promise<SeedReport> {
    const text = await readFile(filePath, 'utf8');
    return this.seedFromText(text);
  }

  async seedFromText(text: string): Promise<SeedReport> {
    const byName = new Map<string, NewSpot>();
    for (const row of parseSpotsCsv(text)) {
      let spot: NewSpot;
      try {
        spot = createNewSpot(row);
      } catch (error) {
        throw new CsvParseError(`line ${row.line}: ${error instanceof Error ? error.message : String(error)}`);
      }
      // 同一文で同じキーを 2 回 upsert すると PostgreSQL がエラーにするため、後勝ちで 1 件に畳む
      if (byName.has(spot.name)) this.log(`Duplicate name in CSV (line ${row.line}), later row wins: ${spot.name}`);
      byName.set(spot.name, spot);
    }

    const result = await this.spots.upsertByName([...byName.values()]);
    const report: SeedReport = { total: byName.size, ...result };
    this.log(
      `Seeded spots: total=${report.total}, inserted=${report.inserted}, updated=${report.updated}, unchanged=${report.unchanged}`,
    );
    return report;
  }
}
