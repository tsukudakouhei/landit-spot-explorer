/** テストで差し替えられるよう fetch を注入可能にする。 */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>;

export const REQUEST_TIMEOUT_MS = 5000;

/** 外部 API の JSON は信用せず、型ガードで絞ってから読む。 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function describeError(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
