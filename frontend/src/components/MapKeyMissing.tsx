"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { LatLng } from "@/lib/geo";

type Props = {
  center: LatLng;
  /** 入力された座標を検索中心にする */
  onSubmitCenter: (center: LatLng) => void;
};

type FieldErrors = { lat?: string; lng?: string };

function validate(latText: string, lngText: string): FieldErrors {
  const errors: FieldErrors = {};
  const lat = Number(latText);
  const lng = Number(lngText);
  if (latText.trim() === "" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    errors.lat = "緯度は -90〜90 の数値で入力してください（例: 35.681）";
  }
  if (lngText.trim() === "" || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    errors.lng = "経度は -180〜180 の数値で入力してください（例: 139.767）";
  }
  return errors;
}

/**
 * GOOGLE_MAPS_BROWSER_KEY が未設定のとき地図の代わりに出すパネル。
 * 地図が無いと中心を動かせないので、緯度経度の入力で検索中心を変えられるようにする。
 */
export function MapKeyMissing({ center, onSubmitCenter }: Props) {
  const id = useId();
  const [latText, setLatText] = useState(String(center.lat));
  const [lngText, setLngText] = useState(String(center.lng));
  const [errors, setErrors] = useState<FieldErrors>({});
  const latRef = useRef<HTMLInputElement>(null);
  const lngRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextErrors = validate(latText, lngText);
    setErrors(nextErrors);
    if (nextErrors.lat) return latRef.current?.focus();
    if (nextErrors.lng) return lngRef.current?.focus();
    onSubmitCenter({ lat: Number(latText), lng: Number(lngText) });
  };

  const inputClass = (hasError: boolean) =>
    `mt-1 block h-11 w-full rounded-md border bg-white px-3 text-base tabular-nums focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600 ${
      hasError ? "border-red-600" : "border-slate-300"
    }`;

  return (
    <div className="bg-slate-100 p-4 sm:p-6 lg:h-full lg:overflow-y-auto">
      <div className="mx-auto max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold">地図を表示するには Google Maps のキーが必要です</h2>
        <p className="mt-1 text-sm text-slate-600">
          キーが無くても、住所表示・半径・カテゴリ・リストはこのまま使えます。下の欄で検索の中心を変えられます。
        </p>

        <form onSubmit={handleSubmit} noValidate className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">検索の中心を座標で指定</h3>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${id}-lat`} className="text-sm font-medium text-slate-700">
                緯度
              </label>
              <input
                ref={latRef}
                id={`${id}-lat`}
                type="number"
                inputMode="decimal"
                step="any"
                min={-90}
                max={90}
                value={latText}
                onChange={(e) => {
                  setLatText(e.target.value);
                  setErrors((prev) => ({ ...prev, lat: undefined }));
                }}
                aria-invalid={errors.lat ? true : undefined}
                aria-describedby={errors.lat ? `${id}-lat-error` : undefined}
                className={inputClass(Boolean(errors.lat))}
              />
              {errors.lat && (
                <p id={`${id}-lat-error`} className="mt-1 text-sm text-red-700">
                  {errors.lat}
                </p>
              )}
            </div>
            <div>
              <label htmlFor={`${id}-lng`} className="text-sm font-medium text-slate-700">
                経度
              </label>
              <input
                ref={lngRef}
                id={`${id}-lng`}
                type="number"
                inputMode="decimal"
                step="any"
                min={-180}
                max={180}
                value={lngText}
                onChange={(e) => {
                  setLngText(e.target.value);
                  setErrors((prev) => ({ ...prev, lng: undefined }));
                }}
                aria-invalid={errors.lng ? true : undefined}
                aria-describedby={errors.lng ? `${id}-lng-error` : undefined}
                className={inputClass(Boolean(errors.lng))}
              />
              {errors.lng && (
                <p id={`${id}-lng-error`} className="mt-1 text-sm text-red-700">
                  {errors.lng}
                </p>
              )}
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 inline-flex h-11 cursor-pointer items-center rounded-md bg-blue-600 px-5 text-base font-medium text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            この地点で検索
          </button>
        </form>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <h3 className="text-sm font-semibold text-slate-800">地図を表示する手順</h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm text-slate-700">
            <li>Google Cloud で Maps JavaScript API を有効にしたブラウザ用キーを作成します。</li>
            <li>
              リポジトリ直下の <code className="rounded bg-slate-100 px-1">.env</code> に{" "}
              <code className="rounded bg-slate-100 px-1 [overflow-wrap:anywhere]">GOOGLE_MAPS_BROWSER_KEY=…</code>{" "}
              を書きます。
            </li>
            <li>
              <code className="rounded bg-slate-100 px-1">docker compose up -d</code>{" "}
              で web を起動し直します（イメージの再ビルドは不要です）。
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
