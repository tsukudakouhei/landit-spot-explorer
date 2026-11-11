"use client";

import { useCallback, useMemo, useState } from "react";
import type { MapSpot, Spot } from "@/lib/api";
import type { Area } from "@/lib/areas";
import { INITIAL_CENTER, type LatLng } from "@/lib/geo";
import { useAllSpots } from "@/lib/hooks/useAllSpots";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useReverseGeocode } from "@/lib/hooks/useReverseGeocode";
import { useSearchCenter } from "@/lib/hooks/useSearchCenter";
import { useAreaCounts, useSpotsSearch } from "@/lib/hooks/useSpotsSearch";
import { AreaPicker } from "./AreaPicker";
import { CategoryFilter } from "./CategoryFilter";
import { CenterAddress } from "./CenterAddress";
import { MapErrorBoundary } from "./MapErrorBoundary";
import { MapKeyMissing } from "./MapKeyMissing";
import { MapView, type Recenter, type Selection } from "./MapView";
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
 * 検索中心を動かすのはユーザーの地図操作とエリアボタン（とキー未設定時の座標入力）だけ。リストクリックは選択とパンのみで再検索しない。
 */
export function SpotExplorer({ apiKey, gridDecimals }: Props) {
  const { center, propose, commit } = useSearchCenter(INITIAL_CENTER, gridDecimals);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_RADIUS_KM);
  const searchRadiusKm = useDebouncedValue(radiusKm, RADIUS_DEBOUNCE_MS);
  const [category, setCategory] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  /** エリアボタンによる地図の移動要求。同じエリアを押し直しても動くよう連番を持つ */
  const [recenter, setRecenter] = useState<Recenter | null>(null);

  const spotsQuery = useSpotsSearch(center, searchRadiusKm, category);
  const geocodeQuery = useReverseGeocode(center);
  const areaCounts = useAreaCounts(searchRadiusKm, category, gridDecimals);
  const spots = spotsQuery.data?.items ?? NO_SPOTS;

  /** 半径内（＝リストに出ている）スポットの id。地図ではこれを濃いピン、それ以外を薄いピンにする */
  const activeIds = useMemo(() => new Set(spots.map((s) => s.id)), [spots]);
  /**
   * 地図に出すスポット。全件が取れていれば全件（カテゴリで絞り込み中はそのカテゴリだけ）、
   * 取れていなければ半径内の検索結果だけを出す（全件取得の失敗で地図が空にならないようにする）。
   */
  const allSpots = useAllSpots().data?.items;
  const mapSpots: MapSpot[] = useMemo(() => {
    if (!allSpots) return spots;
    return category === null ? allSpots : allSpots.filter((s) => s.category === category);
  }, [allSpots, spots, category]);

  const selectFromMap = useCallback(
    (spot: MapSpot) => {
      const position = { lat: spot.lat, lng: spot.lng };
      // 半径の外にある薄いピンを押したら、そのスポットを新しい検索中心にする（検索後にリストへ現れて選択中になる）
      if (!activeIds.has(spot.id)) {
        commit(position);
        setRecenter((prev) => ({ center: position, seq: (prev?.seq ?? 0) + 1 }));
      }
      setSelection({ id: spot.id, source: "map", position });
    },
    [activeIds, commit],
  );

  const selectFromList = useCallback((spot: Spot) => {
    setSelection({ id: spot.id, source: "list", position: { lat: spot.lat, lng: spot.lng } });
  }, []);

  const handleCenterIdle = useCallback((next: LatLng) => propose(next), [propose]);
  const clearCategory = useCallback(() => setCategory(null), []);

  const moveToArea = useCallback(
    (area: Area) => {
      // 検索は地図の移動完了を待たずに始める。地図側は移動後の idle で同じグリッドを提案するだけなので二重検索にならない
      commit(area.center);
      setSelection(null);
      setRecenter((prev) => ({ center: area.center, seq: (prev?.seq ?? 0) + 1 }));
    },
    [commit],
  );

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
                fitRadiusKm={searchRadiusKm}
                spots={mapSpots}
                activeIds={activeIds}
                selection={selection}
                recenter={recenter}
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
        <div className="space-y-4 border-b border-slate-200 bg-slate-50 p-4">
          <h2 className="sr-only">検索条件</h2>
          <AreaPicker
            center={center}
            gridDecimals={gridDecimals}
            counts={areaCounts}
            onSelect={moveToArea}
          />
          <RadiusControl value={radiusKm} onChange={setRadiusKm} />
          <CategoryFilter value={category} onChange={setCategory} />
        </div>
        <SpotList
          query={spotsQuery}
          spots={spots}
          selection={selection}
          onSelect={selectFromList}
          radiusKm={radiusKm}
          category={category}
          onChangeRadius={setRadiusKm}
          onClearCategory={clearCategory}
        />
      </aside>
    </main>
  );
}
