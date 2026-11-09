"use client";

import { useId } from "react";

export const DEFAULT_RADIUS_KM = 2;
export const MIN_RADIUS_KM = 0.5;
export const MAX_RADIUS_KM = 10;
export const RADIUS_STEP_KM = 0.5;

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
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          検索半径
        </label>
        <output htmlFor={id} className="text-base font-semibold tabular-nums text-blue-700">
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
        className="mt-2 h-6 w-full cursor-pointer accent-blue-600"
      />
      <div aria-hidden="true" className="flex justify-between text-xs text-slate-500 tabular-nums">
        <span>{MIN_RADIUS_KM} km</span>
        <span>{MAX_RADIUS_KM} km</span>
      </div>
    </div>
  );
}
