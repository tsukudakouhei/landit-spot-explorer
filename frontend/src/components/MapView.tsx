"use client";

import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { APIProvider, Circle, Map, useMap, useMapsLibrary, type MapEvent } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MapSpot } from "@/lib/api";
import { INITIAL_CENTER, type LatLng } from "@/lib/geo";
import { circleBounds } from "@/lib/map/circleBounds";
import { createIdleGate, type IdleGate } from "@/lib/map/idleGate";

/** 選択中のスポット。どちらから選んだかで、地図をパンするか / リストをスクロールするかを分ける */
export type Selection = {
  id: string;
  source: "map" | "list";
  position: LatLng;
};

/** エリアボタンなどによる「この地点へ地図を移動して」という要求。seq が変わるたびに 1 回動かす */
export type Recenter = {
  center: LatLng;
  seq: number;
};

/** AdvancedMarkerElement には Map ID が必須。Google が開発用に用意しているデモ ID を使う */
const MAP_ID = "DEMO_MAP_ID";
/** 地図ができた直後のズーム。すぐに FitToSearchArea が円に合わせ直す */
const DEFAULT_ZOOM = 14;
/** 円と地図の端のあいだに空ける余白（px） */
const FIT_PADDING_PX = 24;

/** Google Maps の描画 API は CSS クラスを受け取れないので色を文字列で渡す（Tailwind の blue / orange 系に合わせる） */
const COLORS = {
  circleStroke: "#2563eb", // blue-600
  circleFill: "#3b82f6", // blue-500
  pin: { background: "#2563eb", borderColor: "#1e40af", glyphColor: "#ffffff" }, // blue-600 / blue-800
  pinOutside: { background: "#94a3b8", borderColor: "#64748b", glyphColor: "#f1f5f9" }, // slate-400 / slate-500
  pinSelected: { background: "#f97316", borderColor: "#c2410c", glyphColor: "#ffffff" }, // orange-500 / orange-700
} as const;

type Props = {
  apiKey: string;
  /** 丸めた検索中心。半径円はここに描く（＝リストの検索範囲そのもの） */
  searchCenter: LatLng;
  radiusKm: number;
  /** 検索に使っている半径（スライダーが止まってから確定した値）。地図のズームはこちらに合わせる */
  fitRadiusKm: number;
  /** 地図に出す全スポット（半径の外も含む） */
  spots: MapSpot[];
  /** 半径内（＝リストに出ている）スポットの id。濃いピンにする。それ以外は薄いピン */
  activeIds: ReadonlySet<string>;
  selection: Selection | null;
  recenter: Recenter | null;
  /** 地図の移動が止まるたび（idle）に、生の中心座標で呼ばれる。debounce / 丸めは呼び出し側の責務 */
  onCenterIdle: (center: LatLng) => void;
  onMarkerSelect: (spot: MapSpot) => void;
};

export function MapView({
  apiKey,
  searchCenter,
  radiusKm,
  fitRadiusKm,
  spots,
  activeIds,
  selection,
  recenter,
  onCenterIdle,
  onMarkerSelect,
}: Props) {
  /**
   * リスト由来の panTo が終わったときの idle を 1 回だけ捨てるゲート。
   * これが無いと panTo → idle → 中心変更 → 再検索で、押した項目が並び替わったり半径外の項目が消えたりする。
   */
  const [idleGate] = useState(createIdleGate);

  const handleIdle = useCallback(
    (event: MapEvent) => {
      if (!idleGate.consumeIdle()) return;
      const center = event.map.getCenter();
      if (center) onCenterIdle({ lat: center.lat(), lng: center.lng() });
    },
    [onCenterIdle, idleGate],
  );

  return (
    <APIProvider apiKey={apiKey} language="ja" region="JP">
      <Map
        className="h-full w-full"
        defaultCenter={INITIAL_CENTER}
        defaultZoom={DEFAULT_ZOOM}
        mapId={MAP_ID}
        gestureHandling="greedy"
        disableDefaultUI
        zoomControl
        clickableIcons={false}
        onIdle={handleIdle}
        onDragstart={idleGate.userGesture}
        onZoomChanged={idleGate.userGesture}
      >
        <Circle
          center={searchCenter}
          radius={radiusKm * 1000}
          clickable={false}
          strokeColor={COLORS.circleStroke}
          strokeOpacity={0.8}
          strokeWeight={2}
          fillColor={COLORS.circleFill}
          fillOpacity={0.08}
        />
        <ClusteredSpotMarkers
          spots={spots}
          activeIds={activeIds}
          selectedId={selection?.id ?? null}
          onSelect={onMarkerSelect}
        />
        <PanToListSelection selection={selection} idleGate={idleGate} />
        <FitToSearchArea searchCenter={searchCenter} radiusKm={fitRadiusKm} recenter={recenter} idleGate={idleGate} />
      </Map>
      {/* 地図の中心（＝次に検索される地点）の目印 */}
      <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-blue-600/20 shadow ring-2 ring-blue-700">
          <div className="h-2 w-2 rounded-full bg-blue-700" />
        </div>
      </div>
    </APIProvider>
  );
}

/** リストで選ばれたら地図をそのスポットへパンする（マーカー由来の選択ではパンしない） */
function PanToListSelection({
  selection,
  idleGate,
}: {
  selection: Selection | null;
  idleGate: IdleGate;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || selection?.source !== "list") return;
    const current = map.getCenter();
    const willMove =
      !current || current.lat() !== selection.position.lat || current.lng() !== selection.position.lng;
    // 地図が実際に動くときだけ予告する（動かなければ idle は来ず、ゲートが閉じたまま次のユーザー操作を食ってしまう）
    if (willMove) idleGate.expectProgrammaticMove();
    map.panTo(selection.position);
  }, [map, selection, idleGate]);

  return null;
}

/**
 * 検索範囲の円全体が見えるように、地図の中心とズームを合わせる。
 * 合わせるのは「最初の表示」「半径を変えたとき」「エリアボタンで移動したとき」だけ。
 * ユーザーが地図を動かして検索中心が変わったときは合わせない（操作した位置から地図が勝手に動くのを避ける）。
 * 合わせた後の idle は同じグリッドを提案するだけなので再検索は起きない。
 */
function FitToSearchArea({
  searchCenter,
  radiusKm,
  recenter,
  idleGate,
}: {
  searchCenter: LatLng;
  radiusKm: number;
  recenter: Recenter | null;
  idleGate: IdleGate;
}) {
  const map = useMap();
  const centerRef = useRef(searchCenter);
  const handledSeqRef = useRef<number | null>(null);

  useEffect(() => {
    centerRef.current = searchCenter;
  }, [searchCenter]);

  useEffect(() => {
    if (!map) return;
    // 直前のリスト選択で立てた「次の idle を捨てる」予約が残っていても、この移動には持ち越さない
    idleGate.userGesture();
    // エリア移動の要求は 1 回だけ使う。その後に半径だけ変えたときは、今の検索中心に合わせる
    const isNewRecenter = recenter !== null && recenter.seq !== handledSeqRef.current;
    if (recenter) handledSeqRef.current = recenter.seq;
    const target = isNewRecenter ? recenter.center : centerRef.current;
    map.fitBounds(circleBounds(target, radiusKm), FIT_PADDING_PX);
  }, [map, radiusKm, recenter, idleGate]);

  return null;
}

type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement;
  pin: google.maps.marker.PinElement;
};

type PinState = "selected" | "active" | "outside";

/**
 * スポットのマーカーを @googlemaps/markerclusterer でまとめて描く。
 * MarkerClusterer は命令的な API なので、React の宣言的な <AdvancedMarker> ではなく effect で同期する。
 * 半径内は濃いピン、半径の外は薄いピンにする。地図を引くと全国のピンがクラスタにまとまって見える。
 * 選択中のマーカーはクラスタから外して単独で置き、クラスタに埋もれて見えなくならないようにする。
 */
function ClusteredSpotMarkers({
  spots,
  activeIds,
  selectedId,
  onSelect,
}: {
  spots: MapSpot[];
  activeIds: ReadonlySet<string>;
  selectedId: string | null;
  onSelect: (spot: MapSpot) => void;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const entriesRef = useRef(new globalThis.Map<string, MarkerEntry>());
  /** いまクラスタから外して単独表示しているマーカーの id */
  const detachedIdRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // 地図ができたらクラスタラーを 1 つ作る
  useEffect(() => {
    if (!map) return;
    const clusterer = new MarkerClusterer({ map });
    clustererRef.current = clusterer;
    return () => {
      clusterer.clearMarkers();
      clusterer.setMap(null);
      clustererRef.current = null;
    };
  }, [map]);

  // 地図に出すスポットが変わったらマーカーを作り直す（最大 200 件なので差分更新はしない）
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!map || !markerLib || !clusterer) return;

    const entries = new globalThis.Map<string, MarkerEntry>();
    for (const spot of spots) {
      const pin = new markerLib.PinElement(COLORS.pinOutside);
      const marker = new markerLib.AdvancedMarkerElement({
        position: { lat: spot.lat, lng: spot.lng },
        title: spot.name,
        content: pin,
        gmpClickable: true,
      });
      marker.addEventListener("gmp-click", () => onSelectRef.current(spot));
      entries.set(spot.id, { marker, pin });
    }
    entriesRef.current = entries;
    detachedIdRef.current = null;
    clusterer.addMarkers([...entries.values()].map((entry) => entry.marker));

    return () => {
      clusterer.clearMarkers();
      for (const { marker } of entries.values()) marker.map = null;
      entriesRef.current = new globalThis.Map();
      detachedIdRef.current = null;
    };
  }, [map, markerLib, spots]);

  // 半径内かどうか・選択中かどうかでピンの見た目を塗り分ける。マーカーを作り直した直後にも走る
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!map || !markerLib || !clusterer) return;
    const entries = entriesRef.current;

    for (const [id, entry] of entries) {
      applyPinState(entry, id === selectedId ? "selected" : activeIds.has(id) ? "active" : "outside");
    }

    const detachedId = detachedIdRef.current;
    if (detachedId === selectedId) return;
    // 前の選択をクラスタに戻し、新しい選択を単独表示にする
    const prev = detachedId ? entries.get(detachedId) : undefined;
    if (prev) {
      prev.marker.map = null;
      clusterer.addMarker(prev.marker);
    }
    const next = selectedId ? entries.get(selectedId) : undefined;
    if (next) {
      clusterer.removeMarker(next.marker);
      next.marker.map = map;
    }
    detachedIdRef.current = next ? selectedId : null;
  }, [map, markerLib, spots, activeIds, selectedId]);

  return null;
}

function applyPinState({ marker, pin }: MarkerEntry, state: PinState) {
  const colors = state === "selected" ? COLORS.pinSelected : state === "active" ? COLORS.pin : COLORS.pinOutside;
  pin.background = colors.background;
  pin.borderColor = colors.borderColor;
  pin.glyphColor = colors.glyphColor;
  pin.scale = state === "selected" ? 1.4 : state === "active" ? 1 : 0.75;
  marker.zIndex = state === "selected" ? 1000 : state === "active" ? 10 : null;
}
