/**
 * 生 SQL の結果は型情報を持たない（unknown）。DB との境界で形を検証してから domain 型に渡す。
 */
export type Row = Record<string, unknown>;

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null;
}

export function toRows(result: unknown): Row[] {
  if (!Array.isArray(result)) throw new TypeError('Expected an array of rows');
  return result.map((row: unknown) => {
    if (!isRow(row)) throw new TypeError('Expected a row object');
    return row;
  });
}

export function readString(row: Row, key: string): string {
  const value = row[key];
  if (typeof value !== 'string') throw new TypeError(`Expected string column "${key}"`);
  return value;
}

/** double precision は pg ドライバから number で返るが、numeric 等で文字列になっても受け付ける。 */
export function readNumber(row: Row, key: string): number {
  const value = row[key];
  const num = typeof value === 'string' ? Number(value) : value;
  if (typeof num !== 'number' || !Number.isFinite(num)) {
    throw new TypeError(`Expected numeric column "${key}"`);
  }
  return num;
}

export function readBoolean(row: Row, key: string): boolean {
  const value = row[key];
  if (typeof value !== 'boolean') throw new TypeError(`Expected boolean column "${key}"`);
  return value;
}
