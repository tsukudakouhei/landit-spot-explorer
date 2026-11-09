"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { Spot, SpotSearchResponse } from "@/lib/api";
import { formatDistance } from "@/lib/geo";
import { EmptyState } from "./EmptyState";
import { LoadingOverlay } from "./LoadingOverlay";
import type { Selection } from "./MapView";

type Props = {
  query: UseQueryResult<SpotSearchResponse>;
  spots: Spot[];
  selection: Selection | null;
  onSelect: (spot: Spot) => void;
};

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SpotList({ query, spots, selection, onSelect }: Props) {
  const { data, isPending, isError, isFetching, refetch } = query;
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedId = selection?.id ?? null;

  // マーカークリックで選ばれたら、その項目までリストをスクロールする
  useEffect(() => {
    if (selection?.source !== "map") return;
    itemRefs.current.get(selection.id)?.scrollIntoView({
      block: "nearest",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [selection]);

  return (
    <section aria-labelledby="results-heading" className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="flex items-baseline justify-between px-4 pt-3 pb-2">
        <h2 id="results-heading" className="text-base font-semibold">
          検索結果
        </h2>
        <p aria-live="polite" className="text-sm text-slate-600 tabular-nums">
          {data ? `半径 ${data.radiusKm} km 以内 ${data.total} 件` : isPending ? "検索中…" : ""}
        </p>
      </div>

      <LoadingOverlay active={isFetching} />

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {isError ? (
          <EmptyState
            role="alert"
            title="スポットを取得できませんでした"
            description="通信状況を確認して、もう一度お試しください。"
            action={
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="mt-2 inline-flex h-11 cursor-pointer items-center rounded-md bg-blue-600 px-5 text-base font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isFetching ? "再試行中…" : "再試行"}
              </button>
            }
          />
        ) : isPending ? (
          <ListSkeleton />
        ) : spots.length === 0 ? (
          <EmptyState
            title="半径内にスポットがありません。半径を広げてください"
            description="地図を動かして中心を変えるか、カテゴリを「すべて」に戻すと見つかることがあります。"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {spots.map((spot) => {
              const selected = spot.id === selectedId;
              return (
                <li key={spot.id}>
                  <button
                    type="button"
                    ref={(el) => {
                      if (el) itemRefs.current.set(spot.id, el);
                      else itemRefs.current.delete(spot.id);
                    }}
                    onClick={() => onSelect(spot)}
                    aria-pressed={selected}
                    className={`flex w-full cursor-pointer items-start gap-3 border-l-4 px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${
                      selected ? "border-orange-500 bg-orange-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-medium [overflow-wrap:anywhere]">{spot.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                        <span className="rounded bg-slate-100 px-1.5 text-xs font-medium text-slate-700">
                          {spot.category}
                        </span>
                        <span className="[overflow-wrap:anywhere]">{spot.address}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm text-slate-700 tabular-nums">
                      {formatDistance(spot.distanceM)}
                      {selected && <span className="block text-xs font-medium text-orange-700">選択中</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function ListSkeleton() {
  return (
    <ul aria-hidden="true" className="divide-y divide-slate-100">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="px-4 py-3">
          <div className="h-4 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 motion-safe:animate-pulse" />
        </li>
      ))}
    </ul>
  );
}
