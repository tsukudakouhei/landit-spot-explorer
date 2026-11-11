import { INITIAL_CENTER, type LatLng } from "@/lib/geo";

export type Area = {
  id: string;
  label: string;
  /** そのエリアの代表地点（括弧内はボタンの補足に出す） */
  landmark: string;
  center: LatLng;
};

/**
 * ワンタップで移動できる主要エリア。北から順に並べる。
 * 中心はシードデータにある代表的なスポットの座標で、既定の半径（2km）でも結果が出る場所を選んでいる。
 */
export const AREAS: readonly Area[] = [
  { id: "sapporo", label: "札幌", landmark: "時計台", center: { lat: 43.062593, lng: 141.35357 } },
  { id: "tokyo", label: "東京", landmark: "東京駅", center: INITIAL_CENTER },
  { id: "yokohama", label: "横浜", landmark: "みなとみらい", center: { lat: 35.454968, lng: 139.631385 } },
  { id: "kanazawa", label: "金沢", landmark: "兼六園", center: { lat: 36.562128, lng: 136.662652 } },
  { id: "kyoto", label: "京都", landmark: "京都駅", center: { lat: 34.985849, lng: 135.758767 } },
  { id: "nara", label: "奈良", landmark: "興福寺", center: { lat: 34.6831, lng: 135.83 } },
  { id: "osaka", label: "大阪", landmark: "大阪城", center: { lat: 34.687315, lng: 135.526201 } },
  { id: "naha", label: "那覇", landmark: "国際通り", center: { lat: 26.2153, lng: 127.6853 } },
];
