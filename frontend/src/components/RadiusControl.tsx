"use client";

import { useId } from "react";
import {
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  RADIUS_PRESETS_KM,
  RADIUS_STEP_KM,
  formatRadius,
} from "@/lib/radius";

export { DEFAULT_RADIUS_KM } from "@/lib/radius";

type Props = {
  value: number;
  onChange: (radiusKm: number) => void;
};

export function RadiusControl({ value, onChange }: Props) {
  const id = useId();
  const label = `${value.toFixed(1)} km`;

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm font-semibold text-slate-700">
          検索半径
        </label>
        <output htmlFor={id} className="text-lg font-bold tabular-nums text-blue-700">
          {label}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_RADIUS_KM}
        max={MAX_RADIUS_KM}
        step={RADIUS_STEP_KM}
        value={value}
        aria-valuetext={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-8 w-full cursor-pointer accent-blue-600"
      />
      <div aria-hidden="true" className="-mt-1 flex justify-between text-xs text-slate-500 tabular-nums">
        <span>{formatRadius(MIN_RADIUS_KM)}</span>
        <span>{formatRadius(MAX_RADIUS_KM)}</span>
      </div>

      <div role="group" aria-label="半径をすばやく選ぶ" className="mt-2 grid grid-cols-4 gap-2">
        {RADIUS_PRESETS_KM.map((preset) => {
          const active = preset === value;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              aria-pressed={active}
              className={`h-11 cursor-pointer rounded-lg border text-sm font-medium tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none ${
                active
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
              }`}
            >
              {formatRadius(preset)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
