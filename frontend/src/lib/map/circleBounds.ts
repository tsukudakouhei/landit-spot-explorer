import type { LatLng } from "@/lib/geo";

export type Bounds = { north: number; south: number; east: number; west: number };

/** 緯度 1 度あたりの距離（km）。地球を球とみなした近似で、ズーム合わせには十分 */
const KM_PER_DEGREE = 111.32;

/**
 * 中心と半径の円がちょうど収まる矩形を返す。地図の fitBounds に渡して、円全体が見えるズームにする。
 * 経度 1 度の長さは緯度が上がるほど短くなるので cos(緯度) で補正する。
 */
export function circleBounds(center: LatLng, radiusKm: number): Bounds {
  const latDelta = radiusKm / KM_PER_DEGREE;
  const lngDelta = radiusKm / (KM_PER_DEGREE * Math.cos((center.lat * Math.PI) / 180));
  return {
    north: center.lat + latDelta,
    south: center.lat - latDelta,
    east: center.lng + lngDelta,
    west: center.lng - lngDelta,
  };
}
