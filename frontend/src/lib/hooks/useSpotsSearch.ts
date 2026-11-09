import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { searchSpots } from "@/lib/api";
import type { LatLng } from "@/lib/geo";

const FIVE_MINUTES = 5 * 60 * 1000;

/**
 * 半径検索。`center` は roundCoord 済みの座標を渡す前提。
 * queryKey が同じなら（＝同じグリッド・半径・カテゴリ）キャッシュを再利用し API を叩かない。
 * keepPreviousData: キーが変わって取得中の間も前回の結果を出し続ける（リストをちらつかせない）。
 */
export function useSpotsSearch(center: LatLng, radiusKm: number, category: string | null) {
  return useQuery({
    queryKey: ["spots", center.lat, center.lng, radiusKm, category] as const,
    queryFn: ({ signal }) =>
      searchSpots({ lat: center.lat, lng: center.lng, radiusKm, category }, signal),
    placeholderData: keepPreviousData,
    staleTime: FIVE_MINUTES,
  });
}
