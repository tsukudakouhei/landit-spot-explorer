/** ブラウザから叩くのは同一オリジンの /api のみ（src/proxy.ts が API_URL へ転送する） */
export const API_BASE = "/api";

export type Spot = {
  id: string;
  name: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  distanceM: number;
};

export type SpotSearchResponse = {
  items: Spot[];
  total: number;
  center: { lat: number; lng: number };
  radiusKm: number;
};

export type CategoriesResponse = { items: string[] };

/**
 * found: 住所あり / not_found: 住所が無い地点（海上など。確定情報なのでキャッシュしてよい）
 * unavailable: 外部ジオコーダの障害などで今回は取れなかった（一時的。キャッシュしない）
 */
export type GeocodeStatus = "found" | "not_found" | "unavailable";

export type ReverseGeocodeResponse = {
  address: string | null;
  provider: "google" | "gsi";
  cached: boolean;
  gridKey: string;
  /** 古い backend は返さないので省略可。無ければ resolveGeocodeStatus で推定する */
  status?: GeocodeStatus;
};

export type SpotSearchParams = {
  lat: number;
  lng: number;
  radiusKm: number;
  /** null / 空文字 = すべてのカテゴリ */
  category?: string | null;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function buildSpotsSearchUrl({ lat, lng, radiusKm, category }: SpotSearchParams): string {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radiusKm: String(radiusKm),
  });
  if (category) params.set("category", category);
  return `${API_BASE}/spots/search?${params.toString()}`;
}

export function buildCategoriesUrl(): string {
  return `${API_BASE}/spots/categories`;
}

export function buildReverseGeocodeUrl(lat: number, lng: number): string {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return `${API_BASE}/geocode/reverse?${params.toString()}`;
}

/** Nest の ValidationPipe 形式 `{ statusCode, message: string | string[] }` から文言を取り出す */
function extractErrorDetail(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("message" in body)) return null;
  const { message } = body;
  if (typeof message === "string") return message;
  if (Array.isArray(message)) return message.filter((m) => typeof m === "string").join(", ");
  return null;
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { signal, headers: { Accept: "application/json" } });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "サーバーに接続できませんでした");
  }

  if (!res.ok) {
    const body: unknown = await res.json().catch(() => null);
    const detail = extractErrorDetail(body);
    throw new ApiError(res.status, `API エラー (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  return (await res.json()) as T;
}

export function searchSpots(params: SpotSearchParams, signal?: AbortSignal): Promise<SpotSearchResponse> {
  return getJson<SpotSearchResponse>(buildSpotsSearchUrl(params), signal);
}

export function fetchCategories(signal?: AbortSignal): Promise<CategoriesResponse> {
  return getJson<CategoriesResponse>(buildCategoriesUrl(), signal);
}

export function reverseGeocode(lat: number, lng: number, signal?: AbortSignal): Promise<ReverseGeocodeResponse> {
  return getJson<ReverseGeocodeResponse>(buildReverseGeocodeUrl(lat, lng), signal);
}
