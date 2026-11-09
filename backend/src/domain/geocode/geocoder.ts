export type GeocodeProvider = 'google' | 'gsi';

/**
 * 逆ジオコーディングの結果。「住所が無い」と「取得できなかった」を型で区別する。
 * - found:       住所が取れた
 * - not_found:   問い合わせは成功したが住所が無い（海上など）。キャッシュしてよい
 * - unavailable: HTTP エラー・タイムアウト・キー不正など。一時的な失敗なのでキャッシュしてはいけない
 */
export type GeocodeResult =
  | { readonly kind: 'found'; readonly address: string; readonly provider: GeocodeProvider }
  | { readonly kind: 'not_found'; readonly provider: GeocodeProvider }
  | { readonly kind: 'unavailable'; readonly provider: GeocodeProvider; readonly reason: string };

export const GEOCODER = Symbol('GEOCODER');

/** 逆ジオコーディングのポート。Google / 国土地理院などの実装を差し替えられる。 */
export interface Geocoder {
  /** 外部 API の失敗は例外ではなく unavailable で返す（住所は補助情報で、API 全体を 500 にしないため）。 */
  reverse(lat: number, lng: number): Promise<GeocodeResult>;
}
