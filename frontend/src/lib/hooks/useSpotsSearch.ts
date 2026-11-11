import { keepPreviousData, queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { searchSpots } from "@/lib/api";
import { AREAS } from "@/lib/areas";
import { roundCoord, type LatLng } from "@/lib/geo";

const FIVE_MINUTES = 5 * 60 * 1000;

/** 半径検索のクエリ定義。画面の検索とエリア別件数で同じ queryKey を使い、キャッシュを共有する */
function spotsSearchOptions(center: LatLng, radiusKm: number, category: string | null) {
  return queryOptions({
    queryKey: ["spots", center.lat, center.lng, radiusKm, category] as const,
    queryFn: ({ signal }) =>
      searchSpots({ lat: center.lat, lng: center.lng, radiusKm, category }, signal),
    staleTime: FIVE_MINUTES,
  });
}

/**
 * 半径検索。`center` は roundCoord 済みの座標を渡す前提。
 * queryKey が同じなら（＝同じグリッド・半径・カテゴリ）キャッシュを再利用し API を叩かない。
 * keepPreviousData: キーが変わって取得中の間も前回の結果を出し続ける（リストをちらつかせない）。
 */
export function useSpotsSearch(center: LatLng, radiusKm: number, category: string | null) {
  return useQuery({
    ...spotsSearchOptions(center, radiusKm, category),
    placeholderData: keepPreviousData,
  });
}

/**
 * カテゴリで絞り込んでいる間だけ、各エリアの件数を調べる（エリア id → 件数。取得中のエリアは入らない）。
 * 「このカテゴリはどのエリアにあるか」を、エリアを 1 つずつ開かなくても分かるようにするため。
 * 既存の半径検索をエリアの数だけ呼ぶ。キーが画面の検索と同じなので、そのエリアへ移動したときは通信せずに表示できる。
 */
export function useAreaCounts(radiusKm: number, category: string | null, gridDecimals: number): Record<string, number> {
  return useQueries({
    queries: AREAS.map((area) => ({
      ...spotsSearchOptions(roundCoord(area.center.lat, area.center.lng, gridDecimals), radiusKm, category),
      enabled: category !== null,
    })),
    combine: (results) => {
      const counts: Record<string, number> = {};
      results.forEach((result, i) => {
        if (category !== null && result.data) counts[AREAS[i].id] = result.data.items.length;
      });
      return counts;
    },
  });
}
