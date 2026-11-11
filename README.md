# landit-spot-explorer

地図を動かすと、地図の中心から指定した半径内にあるスポットを地図上のマーカーとリストに同時に表示し、中心地点の住所をリアルタイムに表示する Web アプリです。Next.js（App Router）/ NestJS / PostgreSQL（PostGIS）で構成し、`docker compose up` 一発で DB・API・フロントエンドが起動し、200 件のシードデータが自動投入されます。半径検索は PostGIS の空間インデックスに、住所取得の呼び出し抑制は「約 100m グリッドに丸めた座標」をキーにしたサーバー側キャッシュとクライアント側キャッシュの二段構えに担わせ、課題の歓迎要件に **データ設計で答える** ことを主眼にしました。

---

## アーキテクチャ

```mermaid
flowchart LR
  B[ブラウザ] -- "/api/*（同一オリジン）" --> W[web<br/>Next.js :3000]
  B -- 地図タイル --> GM[(Google Maps<br/>JavaScript API)]
  W -- "proxy.ts → http://api:3001" --> A[api<br/>NestJS :3001]
  A -- "ST_DWithin / geocode_cache" --> D[(db<br/>PostGIS :5432)]
  A -- キーあり --> GG[(Google<br/>Geocoding API)]
  A -- キーなし --> GSI[(国土地理院<br/>逆ジオコーダ)]
```

| service | 役割 | ポート |
|---|---|---|
| `db` | `postgis/postgis:16-3.4`。データは named volume `pgdata` | 5432 |
| `api` | NestJS + TypeORM。起動時に migration → シード投入 → listen | 3001 |
| `web` | Next.js（`output: 'standalone'`）。`/api/*` を api へ転送 | 3000 |

起動順は `db`（healthy）→ `api`（`/health` が healthy）→ `web`。ブラウザは常に同一オリジンの `/api/...` を叩き、Next.js の `src/proxy.ts`（middleware 相当）がリクエストごとに `API_URL` を読んで api に転送するため CORS 設定に依存しません。

### ディレクトリ構成

```
landit-spot-explorer/
  docker-compose.yml  .env.example  Makefile  README.md
  backend/                     NestJS + TypeORM（3 層クリーンアーキテクチャ）
    seed/spots.csv             シード CSV（200 件: name,category,lat,long,address）
    src/
      domain/                  純 TS。Nest / TypeORM を import しない
        spot/                  Spot エンティティ、SpotRepository ポート
        geocode/               Geocoder ポート、GeocodeCacheRepository ポート、toGridKey()
      application/             ユースケース（domain のみに依存）
        search-spots.usecase.ts / list-categories.usecase.ts / reverse-geocode.usecase.ts
      infrastructure/          外界との接続（ここだけがフレームワークを知る）
        persistence/typeorm/   ORM エンティティ、リポジトリ実装、migrations
        geocoding/             GoogleGeocoder / GsiGeocoder（アダプタ）
        http/                  controller と DTO（class-validator）
        seed/                  CSV シーダー
        modules/               Nest Module による DI 配線
  frontend/                    Next.js App Router + Tailwind
    src/
      app/                     page.tsx（Server Component がブラウザ用キーを実行時に読む）
      components/              SpotExplorer（状態の親）/ MapView / SpotList / RadiusControl ...
      lib/                     api.ts、geo.ts（座標の丸め）、hooks（TanStack Query）
      proxy.ts                 /api/* を API_URL へ実行時に転送
  docs/                        設計契約（API・スキーマ・環境変数の取り決め）
```

### バックエンドの 3 層

| 層 | 責務 | 依存してよいもの |
|---|---|---|
| **domain** | `Spot` エンティティ、グリッドキー計算、ポート（`SpotRepository` / `Geocoder` / `GeocodeCacheRepository`）の interface と DI トークン | なし（純 TypeScript） |
| **application** | ユースケース。`SearchSpotsUseCase`（半径検索）、`ListCategoriesUseCase`、`ReverseGeocodeUseCase`（グリッド丸め → キャッシュ参照 → TTL 判定 → Geocoder 呼び出し → upsert） | domain のみ |
| **infrastructure** | TypeORM リポジトリ、Google / 国土地理院アダプタ、HTTP controller、CSV シーダー、Nest Module での DI 配線 | すべて |

依存の向きは常に infrastructure → application → domain です。ユースケースはポートをモックするだけでユニットテストできます。

### API 一覧（すべて GET / JSON）

| エンドポイント | 説明 |
|---|---|
| `GET /health` | `{ "status": "ok" }`。compose の healthcheck が使用 |
| `GET /spots/search?lat=&lng=&radiusKm=&category=` | 中心から半径内のスポットを距離昇順で返す。`lat∈[-90,90]`、`lng∈[-180,180]`、`radiusKm∈(0,50]`、`category` は任意（完全一致）。不正値は 400 |
| `GET /spots` | 全スポット（地図に全体を薄いピンで表示するために使う）。`{ items, total }` |
| `GET /spots/categories` | カテゴリ一覧（重複なし） |
| `GET /geocode/reverse?lat=&lng=` | 中心座標の住所。`{ address, provider: "google" \| "gsi", cached, gridKey, status }`。`status` は `found` / `not_found`（海上など住所が無い）/ `unavailable`（外部 API の失敗）。後ろ 2 つは `address: null` |

---

## 環境構築

**必要なもの**: Docker（Docker Compose v2）。ホストで個別に開発する場合のみ Node.js 22 と npm。

```bash
git clone <this-repo> landit-spot-explorer
cd landit-spot-explorer
cp .env.example .env   # 任意。無くても既定値で起動します
```

### Google API キー（任意）

キーが無くても起動・動作確認できます。

| 変数 | 使う場所 | 未設定時の挙動 |
|---|---|---|
| `GOOGLE_MAPS_BROWSER_KEY` | web → ブラウザ（Maps JavaScript API） | 地図の代わりに「キー未設定」の案内パネルを表示。リスト・半径検索・住所表示は動作し、場所は「エリアへ移動」ボタン（札幌〜那覇の 8 エリア）で変えられる |
| `GOOGLE_GEOCODING_API_KEY` | api（Geocoding API。ブラウザには出ない） | 国土地理院の逆ジオコーダに自動フォールバック |

取得手順（詳細は `.env.example` のコメント）:

1. Google Cloud Console でプロジェクトを作り、Maps JavaScript API と Geocoding API を有効化する
2. API キーを **2 本** 作る
3. ブラウザ用: アプリ制限「ウェブサイト」に `http://localhost:3000/*`、API 制限は Maps JavaScript API のみ
4. サーバー用: API 制限は Geocoding API のみ
5. `.env` に設定して `docker compose up -d` で反映（ブラウザ用キーは実行時に読むので **再ビルド不要**）

その他の変数（`POSTGRES_*`、`CORS_ORIGIN`、`GEOCODE_CACHE_TTL_DAYS`、`GEOCODE_GRID_DECIMALS` など）は `.env.example` にすべて既定値と説明付きで載せています。

---

## 実行手順

### Docker で起動（推奨）

```bash
docker compose up --build        # または make up
```

1. 初回起動時、api のログに migration とシード投入の完了が出ることを確認します

   ```bash
   docker compose logs api | grep -i seed
   # api-1  | Seeded spots: total=200, inserted=200, updated=0, unchanged=0
   # 2 回目以降の起動では inserted=0, updated=0, unchanged=200（何も書き換えない）
   ```

2. ブラウザで http://localhost:3000 を開きます。初期表示は東京駅を中心に半径 2km です
3. 地図をドラッグすると、移動が止まってから 400ms 後に半径検索と住所取得が走ります。半径はスライダー（0.5〜10km）で変更できます

API を直接確認する例:

```bash
# ヘルスチェック
curl "http://localhost:3001/health"

# 東京駅から半径 2km のスポット（距離昇順）
curl "http://localhost:3001/spots/search?lat=35.681236&lng=139.767125&radiusKm=2"

# カテゴリ一覧
curl "http://localhost:3001/spots/categories"

# 東京駅の住所（2 回目は "cached": true になる）
curl "http://localhost:3001/geocode/reverse?lat=35.681236&lng=139.767125"

# バリデーションエラー（400）
curl -i "http://localhost:3001/spots/search?lat=999&lng=139.76&radiusKm=2"
```

停止・初期化:

```bash
docker compose down       # 停止（DB データは残る。再起動してもシードは二重投入されない）
docker compose down -v    # DB ボリュームごと削除して初期状態に戻す
```

### ホストで個別に開発する場合

```bash
docker compose up -d db                 # DB だけコンテナで起動
cd backend  && npm ci && npm run migration:run && npm run seed && npm run start:dev   # :3001
cd frontend && npm ci && npm run dev                                                  # :3000
```

どちらも `.env` を自動では読みません。既定値（`DATABASE_URL=postgres://app:app@localhost:5432/spots`、`API_URL=http://localhost:3001`）で上記の構成に繋がります。変えたいときは環境変数として渡してください。

### テスト

```bash
cd backend  && npm test     # Jest 127 件（DB 不要）: ユースケース（ポートをモック）、グリッドキー、
                            #   Google / 国土地理院アダプタ（fetch をモック）、CSV パーサ、DTO バリデーション、
                            #   @nestjs/testing + supertest による controller の e2e
cd backend  && npm run lint # ESLint。domain / application から @nestjs・typeorm を import すると落ちる（層の境界を機械的に強制）
cd frontend && npm test     # Vitest 53 件: 座標の丸め・同一グリッド判定、半径の提案、エリア定義、円の表示範囲、API クライアント、
                            #   検索中心の debounce（fake timers）、リスト由来の panTo 後の idle を捨てる判定
```

実 PostGIS を使う統合テスト（マイグレーション → シード 2 回 → `ST_DWithin` 検索 → `geocode_cache` upsert、プロバイダ切替時のキャッシュ上書き、10 件）は、専用 DB を指定したときだけ動きます。**指定した DB のテーブルを作り直す**ため、DB 名が `_test` で終わらない場合は実行を拒否します。

```bash
docker run -d --rm --name spots-test-db -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app \
  -e POSTGRES_DB=spots_test -p 55432:5432 postgis/postgis:16-3.4
cd backend && TEST_DATABASE_URL=postgres://app:app@localhost:55432/spots_test npm run test:integration
docker stop spots-test-db
```

---

## 使用した主要ライブラリとその選定理由

| ライブラリ | 用途 | 選定理由 |
|---|---|---|
| **Next.js（App Router）** | フロントエンド | 課題指定。Server Component で環境変数を **実行時に** 読んでクライアントに渡せるため、ブラウザ用キーをビルドに焼き込まずに済む。`proxy.ts`（middleware）で API を同一オリジン化でき CORS 不要 |
| **Tailwind CSS** | スタイリング | 課題指定。最低限の UI を CSS ファイルを増やさずに組める |
| **NestJS** | API サーバー | 課題指定。DI コンテナがあるので、ポート（interface）に対する実装の差し替え（Google / 国土地理院）をモジュール配線だけで表現できる |
| **TypeORM** | DB アクセス・マイグレーション | Nest との統合が標準的。PostGIS の生成列や GiST インデックスはマイグレーションを生 SQL で書き、検索・upsert はパラメータ化した生 SQL で `ST_DWithin` / `ON CONFLICT` を使う、と使い分けられる |
| **PostgreSQL + PostGIS** | データストア・空間検索 | 半径検索を DB の責務にするため。`geography(Point,4326)` + GiST インデックス + `ST_DWithin` / `ST_Distance` で、距離計算（Haversine）をアプリに自前実装しない。件数が増えてもインデックスで絞れる |
| **@vis.gl/react-google-maps** | 地図表示 | Google 公式系の React ラッパー。App Router のクライアントコンポーネントで `idle` イベントや `panTo` を素直に扱える |
| **@googlemaps/markerclusterer** | マーカーのクラスタリング | 半径を広げてマーカーが密集したときの視認性確保。Google 公式ライブラリで上記ラッパーと組み合わせられる |
| **TanStack Query** | サーバー状態のキャッシュ | 「丸めた中心座標 + 半径 + カテゴリ」を queryKey にすることで、同じ条件の再検索をキャッシュから即時表示できる。ローディング・エラー・再試行の状態管理も任せられる |
| **class-validator**（+ class-transformer） | API 入力検証 | Nest 標準の `ValidationPipe` と組み合わせ、緯度経度・半径の範囲チェックを DTO の宣言で書ける。エラー形式が Nest 標準に揃う |

---

## 実装時に特に工夫した点、および技術的な判断を行った箇所

### 1. 半径検索は DB（PostGIS）に任せる

位置用のインデックスを張り、「半径 N km 以内」の絞り込みと距離計算を SQL（`ST_DWithin`）で行います。全件をアプリ側で計算する方法と違い、件数が増えても近くのスポットだけを調べれば済みます。

### 2. 住所の取得結果を DB にキャッシュする

座標を約 100m のマス目に丸めた値をキーにして、住所を 30 日間保存します。同じマス目への 2 回目以降は外部 API を呼ばないので、費用と待ち時間を減らせます。

### 3. 地図を少し動かしただけでは再検索しない

地図が止まってから 400ms 待ち、中心が同じマス目の中なら API を呼びません。ドラッグ中に発生する無駄な通信を防ぎます。

---

## 時間が足りず実装を簡略化した箇所や、今後の改善点

| 簡略化した点 | 現状 | 今後の改善 |
|---|---|---|
| **検索は半径のみ** | 地図に見えている範囲ではなく、中心からの半径で検索している | 表示範囲で検索するエンドポイントを追加し、切り替えられるようにする |
| **全スポットを一度に取得** | 地図には半径の外のスポットも薄いピンで出しており、そのために 200 件すべてを 1 回で取得している。半径検索もページング無しで全件を返す | 件数が増えたら、地図に見えている範囲のスポットだけを取得する方式に変える。リストにはページングを入れる |
| **地名での検索無し** | 離れた場所へは、地図を引いてピンを選ぶか、8 エリアのボタンで移動する。地名を入力して探すことはできない | 地名から座標を引く検索ボックスを追加する |
| **キー無しでは地図が出ない** | Google のキーが無い場合、リスト・半径検索・住所表示は動くが地図は表示されない。住所は国土地理院から取得し、首都圏以外では町名だけになる | キー無しのときは別の地図ライブラリ（MapLibre + 地理院タイル）で表示する |
| **地図操作の自動テスト無し** | 地図の操作は実キーを使って手動で確認した。自動テストは API とロジック部分のみ | Playwright でブラウザ操作のテストを追加する |
| **認証・利用制限無し** | API は誰でも呼べる。外部 API を呼ぶ住所取得にも回数制限が無い | 認証と、IP ごとの回数制限を入れる |
| **古いキャッシュの掃除無し** | 期限切れの住所は再取得時に上書きされるだけで、二度と見られない地点の行は残り続ける | 古い行を定期的に削除するジョブを追加する |
