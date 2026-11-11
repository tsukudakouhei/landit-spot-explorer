"use client";

import { AREAS, type Area } from "@/lib/areas";
import { isSameGrid, type LatLng } from "@/lib/geo";

type Props = {
  /** 丸めた検索中心。エリアの代表地点と同じグリッドなら、そのボタンを選択中にする */
  center: LatLng;
  gridDecimals: number;
  onSelect: (area: Area) => void;
};

/**
 * 主要エリアへワンタップで移動するボタン。
 * 緯度経度を知らなくても、また地図を長く動かさなくても、離れた場所のスポットを探せるようにする。
 */
export function AreaPicker({ center, gridDecimals, onSelect }: Props) {
  return (
    <div role="group" aria-labelledby="area-picker-label">
      <p id="area-picker-label" className="text-sm font-semibold text-slate-700">
        エリアへ移動
      </p>
      <div className="mt-1 grid grid-cols-4 gap-2">
        {AREAS.map((area) => {
          const active = isSameGrid(center, area.center, gridDecimals);
          return (
            <button
              key={area.id}
              type="button"
              onClick={() => onSelect(area)}
              aria-pressed={active}
              title={`${area.label}（${area.landmark}）へ移動`}
              className={`h-11 cursor-pointer rounded-lg border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {area.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
