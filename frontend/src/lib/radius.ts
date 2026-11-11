export const DEFAULT_RADIUS_KM = 2;
export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 10;
export const RADIUS_STEP_KM = 0.5;

/** よく使う半径。スライダーを細かく動かさなくても 1 タップで切り替えられるようにする */
export const RADIUS_PRESETS_KM = [1, 2, 5, 10] as const;

/**
 * 0 件のときに提案する「次に広い半径」。今の倍（刻みに合わせて丸め、上限まで）。
 * すでに上限なら null（＝これ以上は広げられないので、地図を動かす案内に切り替える）。
 */
export function nextWiderRadius(radiusKm: number): number | null {
  if (radiusKm >= MAX_RADIUS_KM) return null;
  const doubled = Math.round((radiusKm * 2) / RADIUS_STEP_KM) * RADIUS_STEP_KM;
  return Math.min(MAX_RADIUS_KM, Math.max(doubled, radiusKm + RADIUS_STEP_KM));
}

/** 表示用。整数は「5 km」、端数は「0.5 km」 */
export function formatRadius(radiusKm: number): string {
  return `${Number.isInteger(radiusKm) ? radiusKm : radiusKm.toFixed(1)} km`;
}
