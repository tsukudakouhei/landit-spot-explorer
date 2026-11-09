"use client";

import { useCallback, useState } from "react";
import type { Spot } from "@/lib/api";
import { INITIAL_CENTER, type LatLng } from "@/lib/geo";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useReverseGeocode } from "@/lib/hooks/useReverseGeocode";
import { useSearchCenter } from "@/lib/hooks/useSearchCenter";
import { useSpotsSearch } from "@/lib/hooks/useSpotsSearch";
import { CategoryFilter } from "./CategoryFilter";
import { CenterAddress } from "./CenterAddress";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { MapKeyMissing } from "./MapKeyMissing";
import { MapView, type Selection } from "./MapView";
import { DEFAULT_RADIUS_KM, RadiusControl } from "./RadiusControl";
import { SpotList } from "./SpotList";

/** スライダーをドラッグしている間は検索しない（止まってから 300ms 後に 1 回だけ検索） */
const RADIUS_DEBOUNCE_MS = 300;
const NO_SPOTS: Spot[] = [];

type Props = {
  /** 空文字なら地図の代わりに MapKeyMissing を出す */
  apiKey: string;
  /** 座標の丸め桁数（GEOCODE_GRID_DECIMALS。既定 3） */
  gridDecimals: number;
};

/**
 * 画面の状態の親。検索条件（中心・半径・カテゴリ）と選択中のスポットだけを持ち、
 * サーバー状態（検索結果・住所）は TanStack Query に任せる。
 *
 * 検索中心を動かすのはユーザーの地図操作（とキー未設定時の座標入力）だけ。リストクリックは選択とパンのみで再検索しない。
 */
export function SpotExplorer({ apiKey, gridDecimals }: Props) {
  const { center, propose, commit } = useSearchCenter(INITIAL_CENTER, gridDecimals);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const searchRadiusKm = useDebouncedValue(radiusKm, RADIUS_DEBOUNCE_MS);
  const [category, setCategory] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  const spotsQuery = useSpotsSearch(center, searchRadiusKm, category);
  const geocodeQuery = useReverseGeocode(center);
  const spots = spotsQuery.data?.items ?? NO_SPOTS;

  const selectFromMap = useCallback((spot: Spot) => {
    setSelection({ id: spot.id, source: "map", position: { lat: spot.lat, lng: spot.lng } });
  }, []);

  const selectFromList = useCallback((spot: Spot) => {
    setSelection({ id: spot.id, source: "list", position: { lat: spot.lat, lng: spot.lng } });
  }, []);

  const handleCenterIdle = useCallback((next: LatLng) => propose(next), [propose]);

  const hasMap = apiKey !== "";

  return (
    <main className="flex flex-col lg:h-dvh lg:flex-row lg:overflow-hidden">
      {/* キー未設定時は案内パネルが全部見えるよう、モバイルでは高さを固定しない */}
      <section
        aria-label="地図"
        className={`flex flex-col lg:h-full lg:w-[65%] ${hasMap ? "h-[60dvh] min-h-[360px]" : ""}`}
      >
        <CenterAddress query={geocodeQuery} center={center} gridDecimals={gridDecimals} />
        <div className="relative min-h-0 flex-1">
          {hasMap ? (
            <MapErrorBoundary>
              <MapView
                apiKey={apiKey}
                searchCenter={center}
                radiusKm={radiusKm}
                spots={spots}
                selection={selection}
                onCenterIdle={handleCenterIdle}
                onMarkerSelect={selectFromMap}
              />
            </MapErrorBoundary>
          ) : (
            <MapKeyMissing center={center} onSubmitCenter={commit} />
          )}
        </div>
      </section>

      <aside className="flex flex-col border-t border-slate-200 bg-white lg:h-full lg:w-[35%] lg:border-t-0 lg:border-l">
        <div className="space-y-4 border-b border-slate-200 p-4">
          <h2 className="sr-only">検索条件</h2>
          <RadiusControl value={radiusKm} onChange={setRadiusKm} />
          <CategoryFilter value={category} onChange={setCategory} />
        </div>
        <SpotList
          query={spotsQuery}
          spots={spots}
          selection={selection}
          onSelect={selectFromList}
        />
      </aside>
    </main>
  );
}
