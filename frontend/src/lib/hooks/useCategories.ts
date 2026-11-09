import { useQuery } from "@tanstack/react-query";
import { fetchCategories } from "@/lib/api";

/** カテゴリ一覧はシード由来でセッション中に変わらないため、一度取れば再取得しない */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"] as const,
    queryFn: ({ signal }) => fetchCategories(signal),
    staleTime: Infinity,
  });
}
