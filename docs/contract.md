# 設計契約（API・DB スキーマ・環境変数・構成）

実装前に決めた、バックエンド / フロントエンド / インフラの間の取り決めです。

## リポジトリ構成
```
landit-spot-explorer/
  docker-compose.yml   .env.example   README.md   .gitignore
  backend/             NestJS + TypeORM（clean architecture）
    seed/spots.csv     シード CSV（200件、列: name,category,lat,long,address）
  frontend/            Next.js App Router + Tailwind
  docs/                contract.md（この文書）
```
Node 22（Docker は node:22-alpine）、パッケージマネージャは npm（package-lock.json をコミット）。

## compose サービス名・ポート
| service | image / build | ホスト公開ポート | 備考 |
|---|---|---|---|
| db  | postgis/postgis:16-3.4 | 5432 | healthcheck: pg_isready。volume `pgdata` |
| api | ./backend (multi-stage) | 3001 | depends_on db healthy。起動時に migration → seed → listen |
| web | ./frontend (multi-stage, `output: 'standalone'`) | 3000 | depends_on api |

## 環境変数（.env.example に全部載せる。compose は `${VAR:-default}` で参照）
### api
- `DATABASE_URL` 例 `postgres://app:app@db:5432/spots`（ローカル開発は `@localhost:5432`）
- `PORT` 既定 3001
- `CORS_ORIGIN` 既定 `http://localhost:3000`
- `GOOGLE_GEOCODING_API_KEY` 任意。空なら国土地理院（GSI）ジオコーダに自動フォールバック
- `GEOCODE_CACHE_TTL_DAYS` 既定 30
- `GEOCODE_GRID_DECIMALS` 既定 3（小数第3位に丸め ≒ 100m グリッド）。1〜6 の整数。api と web の両方が読む
### web
- `API_URL` サーバー側のみ。既定 `http://api:3001`（ローカル開発は `http://localhost:3001`）。`src/proxy.ts`（Next 16 の middleware 相当）がリクエストごとに `process.env.API_URL` を読み `/api/:path*` → `${API_URL}/:path*` に転送する（next.config の `rewrites()` はビルド時に standalone へ焼き込まれ実行時に変えられないため不採用。ブラウザは常に同一オリジン `/api/...` を叩く。CORS 不要）
- `GOOGLE_MAPS_BROWSER_KEY` サーバーコンポーネントが実行時に `process.env` から読み、クライアントコンポーネントへ props で渡す（`NEXT_PUBLIC_` は使わない＝ビルド時固定にしない）。空ならマップの代わりに「キー未設定」の案内パネルを出し、リスト・住所表示は動かす
### db
- `POSTGRES_USER=app` `POSTGRES_PASSWORD=app` `POSTGRES_DB=spots`

## REST API（api、JSON、全て GET、prefix 無し）
### `GET /health` → `200 { "status": "ok" }`
### `GET /spots/search?lat=<number>&lng=<number>&radiusKm=<number>&category=<string?>`
- バリデーション: lat ∈ [-90,90]、lng ∈ [-180,180]、radiusKm ∈ (0, 50]。不正は 400 `{ statusCode, message[] }`（Nest 標準 ValidationPipe 形式）
- 応答 `200`:
```json
{ "items": [ { "id": "uuid", "name": "東京タワー", "category": "観光名所", "address": "東京都港区",
               "lat": 35.658581, "lng": 139.745433, "distanceM": 123.4 } ],
  "total": 1, "center": { "lat": 35.68, "lng": 139.76 }, "radiusKm": 2 }
```
- 並び順: distanceM 昇順。category 指定時は完全一致で絞る。上限なし（200件規模）
- 実装: `ST_DWithin(location, ST_SetSRID(ST_MakePoint(:lng,:lat),4326)::geography, :radiusM)`、distanceM は `ST_Distance(...)`
### `GET /spots/categories` → `200 { "items": ["観光名所", "交通機関", ...] }`（重複なし・五十音順でなく name 順でよい）
### `GET /geocode/reverse?lat=<number>&lng=<number>`
- 応答 `200`:
```json
{ "address": "東京都千代田区丸の内1丁目", "provider": "google" | "gsi", "cached": true, "gridKey": "35.681:139.767",
  "status": "found" | "not_found" | "unavailable" }
```
- 住所が特定できない（海上など）場合は `address: null`、200 で返す。provider はその結果を取得した実装（キャッシュヒット時は保存時の provider）。外部 API の失敗（HTTP エラー・タイムアウト・REQUEST_DENIED）は保存せず、その場で `address: null, cached: false` を返す
- `status`: `found`（住所あり）/ `not_found`（海上など住所が無い。保存する）/ `unavailable`（外部 API 失敗。保存しない）
- キャッシュが有効なのは「TTL 内 かつ 保存時の provider が現在の Geocoder と同じ」とき。取り直しが unavailable で、期限切れまたは別 provider の行が残っていればその住所を `cached: true` で返す（stale-if-error）
- 処理: 座標を `GEOCODE_GRID_DECIMALS` 桁に丸め `gridKey = "<lat>:<lng>"` → `geocode_cache` を見る（fetched_at が TTL 内なら cached:true で返す）→ 無ければ Geocoder ポートを呼び、結果を upsert して cached:false で返す

## DB スキーマ（TypeORM migration。生 SQL 可）
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE spots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  category text NOT NULL,
  address text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spots_location_gist ON spots USING GIST (location);
CREATE INDEX spots_category_idx ON spots (category);
CREATE TABLE geocode_cache (
  grid_key text PRIMARY KEY,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  formatted_address text NULL,
  provider text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
```
シードは `backend/seed/spots.csv` を `name` で冪等 upsert（ON CONFLICT (name) DO UPDATE）。CSV の列名は `long`（lng ではない）。

## backend 層構成（clean architecture・3層）
```
backend/src/
  domain/            純 TS。Nest / TypeORM を import しない
    spot/ spot.entity.ts（Spot）, spot.repository.ts（interface SpotRepository + token）
    geocode/ geocoder.ts（interface Geocoder { reverse(lat,lng): Promise<GeocodeResult> } + token。GeocodeResult = {kind:'found',address,provider} | {kind:'not_found',provider} | {kind:'unavailable',provider,reason}。found / not_found は保存、unavailable は保存しない）
             geocode-cache.repository.ts（interface GeocodeCacheRepository + token）, grid-key.ts（toGridKey(lat,lng,decimals)）
  application/       ユースケース。domain のみに依存
    search-spots.usecase.ts（SearchSpotsUseCase）, list-categories.usecase.ts, reverse-geocode.usecase.ts（ReverseGeocodeUseCase）
  infrastructure/
    persistence/typeorm/ … entity（SpotOrmEntity, GeocodeCacheOrmEntity）, repository 実装, migrations/, data-source.ts
    geocoding/ google-geocoder.ts, gsi-geocoder.ts
    http/ spots.controller.ts, geocode.controller.ts, health.controller.ts, dto/
    seed/ csv-seeder.ts
    modules/ … Nest Module で DI 配線（ポートのトークンに実装を provide）
  main.ts
```
DI トークンは `Symbol`/文字列定数を domain 側で定義（例 `SPOT_REPOSITORY`, `GEOCODER`, `GEOCODE_CACHE_REPOSITORY`）。
GSI 逆ジオ API: `https://mreversegeocoder.gsi.go.jp/reverse-geocoder/LonLatToAddress?lat=<lat>&lon=<lng>` → `{ results: { muniCd, lv01Nm } }`。muniCd → 市区町村名は同梱の対応表（`infrastructure/geocoding/gsi-muni.ts`、東京都の 62 市区町村＋近隣主要市は最低限網羅。不明コードは lv01Nm のみ返す）。
Google: `https://maps.googleapis.com/maps/api/geocode/json?latlng=<lat>,<lng>&language=ja&key=...` → `results[0].formatted_address`（先頭の「日本、〒xxx-xxxx 」は取り除く）。

## frontend 構成
```
frontend/src/
  app/ layout.tsx, page.tsx（Server Component: process.env.GOOGLE_MAPS_BROWSER_KEY を読み <SpotExplorer apiKey=.../> に渡す）, providers.tsx（TanStack QueryClientProvider）
  components/ SpotExplorer.tsx（状態の親）, MapView.tsx（@vis.gl/react-google-maps + @googlemaps/markerclusterer）, SpotList.tsx, RadiusControl.tsx, CategoryFilter.tsx, CenterAddress.tsx, MapKeyMissing.tsx, EmptyState / LoadingOverlay
  lib/ api.ts（fetch ラッパ。`/api/...`）, geo.ts（roundCoord(lat,lng,decimals=3)、同じキー判定）, hooks/ useSpotsSearch.ts, useReverseGeocode.ts（TanStack Query。queryKey は丸めた座標 + radiusKm + category）
```
- 地図 `idle`（移動終了）で中心を取得 → 400ms debounce → 丸めキーが前回と同じなら何もしない
- 初期中心: 東京駅 35.681236,139.767125、初期半径 2km、スライダー範囲 0.5〜10km（step 0.5）
- マーカークリック → リストの該当項目をハイライト＋スクロール。リストクリック → 地図を panTo
- 状態表示: 検索中はリスト上部にローディングバー、0件は「半径内にスポットがありません。半径を広げてください」、API エラーは再試行ボタン
- 住所バーは地図上部に固定表示。取得中は前回住所を薄く表示（ちらつかせない）、`cached` のときは小さく「cache」バッジ
