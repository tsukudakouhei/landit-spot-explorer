export type LatLng = { lat: number; lng: number };

/** 小数第3位 ≒ 緯度 111m / 経度 91m（東京）。バックエンドの GEOCODE_GRID_DECIMALS と同じ既定値 */
export const GRID_DECIMALS = 3;
const MIN_GRID_DECIMALS = 1;
const MAX_GRID_DECIMALS = 6;

/**
 * 環境変数 GEOCODE_GRID_DECIMALS の値を丸め桁数として解釈する。
 * 1〜6 の整数以外（未設定・空・小数・範囲外・数字以外）は既定の 3。
 */
export function parseGridDecimals(raw: string | undefined): number {
  if (raw === undefined || !/^\s*\d+\s*$/.test(raw)) return GRID_DECIMALS;
  const n = Number(raw);
  return n >= MIN_GRID_DECIMALS && n <= MAX_GRID_DECIMALS ? n : GRID_DECIMALS;
}

/** 東京駅 */
export const INITIAL_CENTER: LatLng = { lat: 35.681236, lng: 139.767125 };

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  // バックエンド（toGridKey）と同じ式。Math.round は負の .5 を 0 方向へ丸める（-0.5 → -0）ため、
  // 絶対値で四捨五入して符号を戻す（-0.5 → -1）。これでフロントとサーバーのグリッドが一致する
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
  // -0.0004 などは -0 になる。キー文字列が "-0" と "0" で割れないよう正規化する
  return Object.is(rounded, -0) ? 0 : rounded;
}

/** 座標を小数第 `decimals` 位に丸める。API 呼び出しとキャッシュのキーはこの値で作る */
export function roundCoord(lat: number, lng: number, decimals: number = GRID_DECIMALS): LatLng {
  return { lat: roundTo(lat, decimals), lng: roundTo(lng, decimals) };
}

/** 丸めた座標の文字列キー（バックエンドの gridKey と同じ "<lat>:<lng>" 形式） */
export function toGridKey(point: LatLng, decimals: number = GRID_DECIMALS): string {
  const r = roundCoord(point.lat, point.lng, decimals);
  return `${r.lat.toFixed(decimals)}:${r.lng.toFixed(decimals)}`;
}

/** 2 点が同じグリッドに入るか（＝ API を叩き直す必要がないか） */
export function isSameGrid(a: LatLng, b: LatLng, decimals: number = GRID_DECIMALS): boolean {
  return toGridKey(a, decimals) === toGridKey(b, decimals);
}

/**
 * 地図の新しい中心から次の検索中心を決める。
 * 同じグリッドなら `prev` をそのまま返す（参照が変わらない → 再レンダー・再検索が起きない）。
 */
export function resolveNextCenter(prev: LatLng, next: LatLng, decimals: number = GRID_DECIMALS): LatLng {
  return isSameGrid(prev, next, decimals) ? prev : roundCoord(next.lat, next.lng, decimals);
}

/** 距離の表示: 1km 未満は m、以上は km（小数1位） */
export function formatDistance(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}
