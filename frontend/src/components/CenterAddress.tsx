"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import type { ReverseGeocodeResponse } from "@/lib/api";
import type { LatLng } from "@/lib/geo";
import { isUnresolvedAddress } from "@/lib/hooks/useReverseGeocode";

type Props = {
  query: UseQueryResult<ReverseGeocodeResponse>;
  /** 丸めた検索中心（住所が取れないときの補助表示） */
  center: LatLng;
  /** 座標表示の桁数（丸め桁数と同じ） */
  gridDecimals: number;
};

const PROVIDER_LABEL: Record<ReverseGeocodeResponse["provider"], string> = {
  google: "Google",
  gsi: "国土地理院",
};

/**
 * 地図上部に固定する住所バー。
 * 取得中は前回の住所を薄く出し続け（keepPreviousData）、空白やスピナーへの置き換えでちらつかせない。
 */
export function CenterAddress({ query, center, gridDecimals }: Props) {
  const { data, isPending, isError, isFetching, isPlaceholderData, refetch } = query;
  const isRefreshing = isFetching && isPlaceholderData;

  return (
    <header className="flex min-h-[72px] shrink-0 flex-col justify-center gap-0.5 border-b border-slate-200 bg-white px-4 py-2">
      <div className="flex items-center gap-2">
        <h1 className="text-sm font-bold text-blue-700">スポット探索</h1>
        <span className="text-xs text-slate-500">地図の中心</span>
        {data?.cached && !isPlaceholderData && (
          <span
            className="rounded border border-emerald-300 bg-emerald-50 px-1.5 text-[11px] leading-4 font-medium text-emerald-800"
            title="サーバーの住所キャッシュから返しました（外部 API は呼んでいません）"
          >
            cache
          </span>
        )}
      </div>

      <div aria-live="polite" aria-busy={isFetching} className="flex items-center gap-2">
        {data ? (
          <p
            className={`text-base font-medium [overflow-wrap:anywhere] transition-opacity motion-reduce:transition-none ${
              isRefreshing ? "opacity-50" : "opacity-100"
            }`}
          >
            {data.address ??
              (isUnresolvedAddress(data) ? "住所を取得できませんでした" : "この地点の住所は特定できません（海上など）")}
            {isRefreshing && <span className="sr-only">（新しい住所を取得中）</span>}
            {isUnresolvedAddress(data) && !isFetching && (
              <button
                type="button"
                onClick={() => refetch()}
                className="ml-2 cursor-pointer text-sm font-normal text-blue-700 underline underline-offset-2 hover:text-blue-900"
              >
                再試行
              </button>
            )}
          </p>
        ) : isError ? (
          <p className="flex flex-wrap items-center gap-2 text-base text-slate-700">
            住所を取得できませんでした。
            <button
              type="button"
              onClick={() => refetch()}
              className="min-h-6 cursor-pointer rounded border border-slate-300 px-2 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-600"
            >
              再試行
            </button>
          </p>
        ) : isPending ? (
          <p className="text-base text-slate-500">住所を取得中…</p>
        ) : null}
      </div>

      <p className="text-xs text-slate-500 tabular-nums">
        {center.lat.toFixed(gridDecimals)}, {center.lng.toFixed(gridDecimals)}
        {data && <span className="ml-2">出典: {PROVIDER_LABEL[data.provider]}</span>}
      </p>
    </header>
  );
}
