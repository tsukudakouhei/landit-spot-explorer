import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { reverseGeocode, type GeocodeStatus, type ReverseGeocodeResponse } from "@/lib/api";
import type { LatLng } from "@/lib/geo";

const THIRTY_MINUTES = 30 * 60 * 1000;

/**
 * 応答の status を返す。status が無い古い応答は安全側に倒す:
 * 住所があれば found、無ければ not_found（unavailable と推定して再取得を繰り返すことはしない）。
 */
export function resolveGeocodeStatus(data: ReverseGeocodeResponse): GeocodeStatus {
  return data.status ?? (data.address !== null ? "found" : "not_found");
}

/**
 * 今回は住所が取れなかった（一時障害）応答か。
 * この場合だけ保持せず、次に同じグリッドを見たら取り直す。not_found（海上など）は cached の真偽に関係なく通常どおり保持する。
 */
export function isAddressUnavailable(data: ReverseGeocodeResponse | undefined): boolean {
  return data !== undefined && resolveGeocodeStatus(data) === "unavailable";
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
    staleTime: (query) => (isAddressUnavailable(query.state.data) ? 0 : THIRTY_MINUTES),
  });
}
