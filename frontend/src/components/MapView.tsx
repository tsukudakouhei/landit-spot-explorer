"use client";

import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { APIProvider, Circle, Map, useMap, useMapsLibrary, type MapEvent } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Spot } from "@/lib/api";
import { INITIAL_CENTER, type LatLng } from "@/lib/geo";
import { createIdleGate, type IdleGate } from "@/lib/map/idleGate";

/** 選択中のスポット。どちらから選んだかで、地図をパンするか / リストをスクロールするかを分ける */
export type Selection = {
  id: string;
  source: "map" | "list";
  position: LatLng;
};

/** AdvancedMarkerElement には Map ID が必須。Google が開発用に用意しているデモ ID を使う */
const MAP_ID = "DEMO_MAP_ID";
/** 半径 2km の円がおおよそ収まるズーム */
const DEFAULT_ZOOM = 14;

/** Google Maps の描画 API は CSS クラスを受け取れないので色を文字列で渡す（Tailwind の blue / orange 系に合わせる） */
const COLORS = {
  circleStroke: "#2563eb", // blue-600
  circleFill: "#3b82f6", // blue-500
  pin: { background: "#2563eb", borderColor: "#1e40af", glyphColor: "#ffffff" }, // blue-600 / blue-800
  pinSelected: { background: "#f97316", borderColor: "#c2410c", glyphColor: "#ffffff" }, // orange-500 / orange-700
} as const;

type Props = {
  apiKey: string;
  /** 丸めた検索中心。半径円はここに描く（＝リストの検索範囲そのもの） */
  searchCenter: LatLng;
  radiusKm: number;
  spots: Spot[];
  selection: Selection | null;
  /** 地図の移動が止まるたび（idle）に、生の中心座標で呼ばれる。debounce / 丸めは呼び出し側の責務 */
  onCenterIdle: (center: LatLng) => void;
  onMarkerSelect: (spot: Spot) => void;
};

export function MapView({ apiKey, searchCenter, radiusKm, spots, selection, onCenterIdle, onMarkerSelect }: Props) {
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
        <ClusteredSpotMarkers spots={spots} selectedId={selection?.id ?? null} onSelect={onMarkerSelect} />
        <PanToListSelection selection={selection} idleGate={idleGate} />
      </Map>
      {/* 地図の中心（＝次に検索される地点）の目印 */}
      <div aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-5 w-5 rounded-full border-2 border-slate-800/70 bg-white/40" />
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

type MarkerEntry = {
  marker: google.maps.marker.AdvancedMarkerElement;
  pin: google.maps.marker.PinElement;
};

/**
 * スポットのマーカーを @googlemaps/markerclusterer でまとめて描く。
 * MarkerClusterer は命令的な API なので、React の宣言的な <AdvancedMarker> ではなく effect で同期する。
 * 選択中のマーカーはクラスタから外して単独で置き、クラスタに埋もれて見えなくならないようにする。
 */
function ClusteredSpotMarkers({
  spots,
  selectedId,
  onSelect,
}: {
  spots: Spot[];
  selectedId: string | null;
  onSelect: (spot: Spot) => void;
}) {
  const map = useMap();
  const markerLib = useMapsLibrary("marker");
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const entriesRef = useRef(new globalThis.Map<string, MarkerEntry>());
  const selectedIdRef = useRef(selectedId);
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

  // 検索結果が変わったらマーカーを作り直す（最大 200 件なので差分更新はしない）
  useEffect(() => {
    const clusterer = clustererRef.current;
    if (!map || !markerLib || !clusterer) return;

    const entries = new globalThis.Map<string, MarkerEntry>();
    for (const spot of spots) {
      const pin = new markerLib.PinElement(COLORS.pin);
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

    const clustered: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const [id, entry] of entries) {
      if (id === selectedIdRef.current) {
        applySelectedStyle(entry, true);
        entry.marker.map = map;
      } else {
        clustered.push(entry.marker);
      }
    }
    clusterer.addMarkers(clustered);

    return () => {
      clusterer.clearMarkers();
      for (const { marker } of entries.values()) marker.map = null;
      entriesRef.current = new globalThis.Map();
    };
  }, [map, markerLib, spots]);

  // 選択が変わったら、前の選択をクラスタに戻し、新しい選択を強調して単独表示にする
  useEffect(() => {
    const clusterer = clustererRef.current;
    const prevId = selectedIdRef.current;
    selectedIdRef.current = selectedId;
    if (!map || !clusterer || prevId === selectedId) return;

    const prev = prevId ? entriesRef.current.get(prevId) : undefined;
    if (prev) {
      applySelectedStyle(prev, false);
      prev.marker.map = null;
      clusterer.addMarker(prev.marker);
    }
    const next = selectedId ? entriesRef.current.get(selectedId) : undefined;
    if (next) {
      clusterer.removeMarker(next.marker);
      applySelectedStyle(next, true);
      next.marker.map = map;
    }
  }, [map, selectedId]);

  return null;
}

function applySelectedStyle({ marker, pin }: MarkerEntry, selected: boolean) {
  const colors = selected ? COLORS.pinSelected : COLORS.pin;
  pin.background = colors.background;
  pin.borderColor = colors.borderColor;
  pin.glyphColor = colors.glyphColor;
  pin.scale = selected ? 1.4 : 1;
  marker.zIndex = selected ? 1000 : null;
}
