const MAX_DECIMALS = 10;

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new RangeError(`decimals must be an integer between 0 and ${MAX_DECIMALS}: ${decimals}`);
  }
}

/**
 * 座標を小数第 decimals 位に丸める。
 * Math.round は負数の .5 を 0 方向に寄せる（-1.5 → -1）ため、絶対値で丸めて符号を戻し、正負で対称にする。
 */
export function roundCoordinate(value: number, decimals: number): number {
  assertDecimals(decimals);
  if (!Number.isFinite(value)) throw new RangeError(`coordinate must be finite: ${value}`);
  const factor = 10 ** decimals;
  const rounded = (Math.sign(value) * Math.round(Math.abs(value) * factor)) / factor;
  // -0 を 0 に正規化する（"-0.000" というキーを作らないため）
  return rounded + 0;
}

/**
 * キャッシュキー "<lat>:<lng>" を作る。桁数を toFixed で固定し、
 * 35.68 と 35.680 が別キーにならないようにする。
 */
export function toGridKey(lat: number, lng: number, decimals: number): string {
  const rLat = roundCoordinate(lat, decimals);
  const rLng = roundCoordinate(lng, decimals);
  return `${rLat.toFixed(decimals)}:${rLng.toFixed(decimals)}`;
}
