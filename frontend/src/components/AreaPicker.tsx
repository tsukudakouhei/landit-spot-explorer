"use client";

import { AREAS, type Area } from "@/lib/areas";
import { isSameGrid, type LatLng } from "@/lib/geo";

type Props = {
  /** 丸めた検索中心。エリアの代表地点と同じグリッドなら、そのボタンを選択中にする */
  center: LatLng;
  gridDecimals: number;
  /** カテゴリで絞り込んでいるときの、エリアごとの件数（エリア id → 件数）。絞り込んでいなければ null */
  counts: Record<string, number> | null;
  onSelect: (area: Area) => void;
};

/**
 * 主要エリアへワンタップで移動するボタン。
 * 緯度経度を知らなくても、また地図を長く動かさなくても、離れた場所のスポットを探せるようにする。
 * カテゴリで絞り込んでいる間は各ボタンに件数を出し、どのエリアに対象があるかを移動する前に分かるようにする。
 */
export function AreaPicker({ center, gridDecimals, counts, onSelect }: Props) {
  return (
    <div role="group" aria-labelledby="area-picker-label">
      <p id="area-picker-label" className="text-sm font-semibold text-slate-700">
        エリアへ移動
      </p>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {AREAS.map((area) => {
          const active = isSameGrid(center, area.center, gridDecimals);
          const count = counts?.[area.id];
          const empty = count === 0;
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelect(area)}
              aria-pressed={active}
              title={`${area.label}（${area.landmark}）へ移動`}
              aria-label={count === undefined ? undefined : `${area.label} ${count} 件`}
              className={`flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : empty
                    ? "border-slate-200 bg-slate-50 text-slate-400 hover:border-slate-300"
                    : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {area.label}
              {count !== undefined && (
                <span
                  className={`min-w-5 rounded-full px-1 text-xs font-semibold tabular-nums ${
                    active ? "bg-white/20 text-white" : empty ? "text-slate-400" : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
