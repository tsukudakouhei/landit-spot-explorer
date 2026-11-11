import { useQuery } from "@tanstack/react-query";
import { fetchAllSpots } from "@/lib/api";

/**
 * 全スポット。半径の外にあるスポットも地図に薄く表示し、地図を引けば全国のどこにあるかが分かるようにする。
 * シード由来でセッション中に変わらないため、一度取れば再取得しない。
 * 200 件規模なので全件を 1 回で取る。件数が増えたら地図の表示範囲で絞って取る方式に変える。
 */
export function useAllSpots() {
  return useQuery({
    queryKey: ["spots", "all"] as const,
    queryFn: ({ signal }) => fetchAllSpots(signal),
    staleTime: Infinity,
  });
}
