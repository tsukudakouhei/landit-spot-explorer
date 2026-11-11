import { connection } from "next/server";
import { SpotExplorer } from "@/components/SpotExplorer";
import { parseGridDecimals } from "@/lib/geo";

export default async function Page() {
  // 静的プリレンダーを止め、リクエスト時に env を読む。
  // これで GOOGLE_MAPS_BROWSER_KEY はビルド時に固定されず、コンテナの環境変数を変えるだけで反映される。
  await connection();
  const mapsApiKey = (process.env.GOOGLE_MAPS_BROWSER_KEY ?? "").trim();
  // バックエンドと同じ丸め桁数を使う（compose で api / web に同じ値を渡す）
  const gridDecimals = parseGridDecimals(process.env.GEOCODE_GRID_DECIMALS);

  return <SpotExplorer apiKey={mapsApiKey} gridDecimals={gridDecimals} />;
}
