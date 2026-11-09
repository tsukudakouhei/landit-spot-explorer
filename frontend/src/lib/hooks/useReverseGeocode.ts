import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { reverseGeocode, type ReverseGeocodeResponse } from "@/lib/api";
import type { LatLng } from "@/lib/geo";

const THIRTY_MINUTES = 30 * 60 * 1000;

/**
 * `address: null` かつ `cached: false` は「今回外部 API から住所が取れなかった」応答。
 * 一時障害の可能性があるので保持せず、次に同じグリッドへ来たら取り直す。
 * （`cached: true` の null はサーバーが確定させた「住所なし（海上など）」なので通常どおり保持する）
 */
export function isUnresolvedAddress(data: ReverseGeocodeResponse | undefined): boolean {
  return data !== undefined && data.address === null && !data.cached;
}

/**
 * 中心の逆ジオコーディング。`center` は roundCoord 済み。
 * 住所は同じグリッドならほぼ変わらないので staleTime は長め（サーバー側にも 30 日の永続キャッシュがある）。
 */
export function useReverseGeocode(center: LatLng) {
  return useQuery({
    queryKey: ["geocode", center.lat, center.lng] as const,
    queryFn: ({ signal }) => reverseGeocode(center.lat, center.lng, signal),
    placeholderData: keepPreviousData,
    staleTime: (query) => (isUnresolvedAddress(query.state.data) ? 0 : THIRTY_MINUTES),
  });
}
