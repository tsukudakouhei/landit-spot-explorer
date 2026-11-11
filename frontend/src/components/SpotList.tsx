"use client";

import type { UseQueryResult } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { Spot, SpotSearchResponse } from "@/lib/api";
import { formatDistance } from "@/lib/geo";
import { formatRadius, nextWiderRadius } from "@/lib/radius";
import { EmptyState } from "./EmptyState";
import { AlertIcon, PinIcon, SearchOffIcon } from "./icons";
import { LoadingOverlay } from "./LoadingOverlay";
import type { Selection } from "./MapView";

type Props = {
  query: UseQueryResult<SpotSearchResponse>;
  spots: Spot[];
  selection: Selection | null;
  onSelect: (spot: Spot) => void;
  /** いまの半径（スライダーの値）。0 件のとき「次に広い半径」を提案するのに使う */
  radiusKm: number;
  category: string | null;
  onChangeRadius: (radiusKm: number) => void;
  onClearCategory: () => void;
};

const PRIMARY_BUTTON =
  "inline-flex h-11 cursor-pointer items-center rounded-lg bg-blue-600 px-5 text-base font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300";
const SECONDARY_BUTTON =
  "inline-flex h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-5 text-base font-medium text-slate-700 hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function SpotList({
  query,
  spots,
  selection,
  onSelect,
  radiusKm,
  category,
  onChangeRadius,
  onClearCategory,
}: Props) {
  const { data, isPending, isError, isFetching, refetch } = query;
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedId = selection?.id ?? null;
  const widerRadius = nextWiderRadius(radiusKm);

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
      <div className="flex items-baseline justify-between gap-3 px-4 pt-3 pb-2">
        <h2 id="results-heading" className="text-base font-semibold">
          検索結果
        </h2>
        <p aria-live="polite" className="text-sm text-slate-600 tabular-nums">
          {data ? (
            <>
              半径 {formatRadius(data.radiusKm)} 以内
              <span className="ml-2 text-base font-bold text-slate-900">{data.total}</span> 件
            </>
          ) : isPending ? (
            "検索中…"
          ) : (
            ""
          )}
        </p>
      </div>

      <LoadingOverlay active={isFetching} />

      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {isError ? (
          <EmptyState
            role="alert"
            icon={<AlertIcon className="h-6 w-6" />}
            title="スポットを取得できませんでした"
            description="通信状況を確認して、もう一度お試しください。"
            action={
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className={PRIMARY_BUTTON}
              >
                {isFetching ? "再試行中…" : "再試行"}
              </button>
            }
          />
        ) : isPending ? (
          <ListSkeleton />
        ) : spots.length === 0 ? (
          <EmptyState
            icon={<SearchOffIcon className="h-6 w-6" />}
            title="半径内にスポットがありません"
            description={
              widerRadius === null
                ? "半径は最大です。地図を動かして中心を変えてみてください。"
                : "半径を広げるか、地図を動かして中心を変えてみてください。"
            }
            action={
              widerRadius !== null || category !== null ? (
                <>
                  {widerRadius !== null && (
                    <button type="button" onClick={() => onChangeRadius(widerRadius)} className={PRIMARY_BUTTON}>
                      半径を {formatRadius(widerRadius)} に広げる
                    </button>
                  )}
                  {category !== null && (
                    <button type="button" onClick={onClearCategory} className={SECONDARY_BUTTON}>
                      カテゴリを「すべて」に戻す
                    </button>
                  )}
                </>
              ) : undefined
            }
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
                    className={`group flex w-full cursor-pointer items-center gap-3 border-l-4 py-3 pr-4 pl-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none ${
                      selected ? "border-orange-500 bg-orange-50" : "border-transparent hover:bg-blue-50/60"
                    }`}
                  >
                    {/* 地図のピンと同じ配色（通常 = 青、選択中 = オレンジ） */}
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                        selected ? "bg-orange-500 text-white" : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      <PinIcon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold text-slate-900 [overflow-wrap:anywhere]">{spot.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 text-xs leading-5 font-medium text-slate-700">
                          {spot.category}
                        </span>
                        <span className="[overflow-wrap:anywhere]">{spot.address}</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-base font-semibold text-slate-800 tabular-nums">
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
        <li key={i} className="flex items-center gap-3 py-3 pr-4 pl-4">
          <div className="h-9 w-9 shrink-0 rounded-full bg-slate-200 motion-safe:animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse" />
            <div className="mt-2 h-3 w-1/2 rounded bg-slate-100 motion-safe:animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}
