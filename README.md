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
| `GOOGLE_MAPS_BROWSER_KEY` | web → ブラウザ（Maps JavaScript API） | 地図の代わりに「キー未設定」の案内パネルを表示。リスト・半径検索・住所表示は動作 |
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
cd backend  && npm test     # Jest 123 件（DB 不要）: ユースケース（ポートをモック）、グリッドキー、
                            #   Google / 国土地理院アダプタ（fetch をモック）、CSV パーサ、DTO バリデーション、
                            #   @nestjs/testing + supertest による controller の e2e
cd backend  && npm run lint # ESLint。domain / application から @nestjs・typeorm を import すると落ちる（層の境界を機械的に強制）
cd frontend && npm test     # Vitest 40 件: 座標の丸め・同一グリッド判定、API クライアント、
                            #   検索中心の debounce（fake timers）、リスト由来の panTo 後の idle を捨てる判定
```

実 PostGIS を使う統合テスト（マイグレーション → シード 2 回 → `ST_DWithin` 検索 → `geocode_cache` upsert、プロバイダ切替時のキャッシュ上書き、9 件）は、専用 DB を指定したときだけ動きます。**指定した DB のテーブルを作り直す**ため、DB 名が `_test` で終わらない場合は実行を拒否します。

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

### 1. 半径検索は PostGIS に任せる

- **決定**: `spots` に `lat` / `lng` の数値列と、そこから自動計算される `location geography(Point,4326)` の **STORED 生成列** を持たせ、GiST インデックスを張る。検索は `ST_DWithin(location, 中心点, 半径m)`、距離は `ST_Distance` で計算し距離昇順で返す
- **理由**: 距離計算を DB に寄せ、Haversine を自前実装しない。生成列なので数値列と空間列の二重管理による不整合が起きず、API は数値列をそのまま返せる。`geography` 型なのでメートル単位で正しく扱える

### 2. 住所 API の呼び出しを「グリッド丸め + 永続キャッシュ」で抑制する

- **決定**: 逆ジオは必ず api 経由。座標を小数第 3 位（緯度 約111m / 経度 約91m）に丸めた `gridKey`（例 `35.681:139.767`）をキーに `geocode_cache` テーブルを先に引き、`fetched_at` が TTL（既定 30 日）以内なら外部 API を呼ばない。応答には `cached` を含め、UI に小さく「cache」バッジを出す。Geocoder の結果は `found` / `not_found`（海上など住所が無い）/ `unavailable`（HTTP エラー・タイムアウト・キー不正）の 3 種に型で分け、**保存するのは確定した結果だけ**。`unavailable` は保存せず、次のリクエストで再問い合わせする（期限切れの住所が残っていればそれを返す = stale-if-error）。キャッシュは保存時の provider が現在の Geocoder と同じときだけ有効で、キー無し（国土地理院）で溜めた住所が Google キー設定後に残り続けることはない。応答の `status` でフロントは「住所が無い」と「取得できなかった（再試行リンクを出す）」を出し分ける
- **理由**: 「今どこを見ているか」を示す用途なら 100m 精度で十分。同じ街区を見直したときに外部 API を叩かない。メモリ内キャッシュでなく Postgres に置くことで、コンテナを再起動しても消えない。失敗を保存しないのは、外部 API の一時障害やキーの打ち間違いが 30 日間「住所なし」として残るのを防ぐため（レビューで実際に見つかった問題）。桁数・TTL は環境変数で調整できる

### 3. 微小な地図移動では再検索しない（クライアント側の二段目）

- **決定**: 地図の `idle`（移動終了）で中心を取得 → 400ms debounce → フロントでもサーバーと同じ桁数で座標を丸め、前回と同じなら何もしない。TanStack Query の queryKey も丸めた座標 + 半径 + カテゴリにする
- **理由**: 歓迎要件「わずかな移動では API を叩かない」をクライアント側でも担保し、サーバー側キャッシュと二段構えにする。一度見た条件に戻ったときは通信せずにキャッシュから即時表示できる。丸めの桁数は api と web が同じ環境変数 `GEOCODE_GRID_DECIMALS` を実行時に読み、丸め方（0 から遠い側への四捨五入）も両者で揃えてテストで固定した。半径スライダーも 300ms debounce し、ドラッグ中は円だけ追従させて検索は止まってから 1 回にする

### 4. バックエンドは 3 層クリーンアーキテクチャ

- **決定**: `domain`（エンティティ・ポート）/ `application`（ユースケース）/ `infrastructure`（TypeORM・外部 API アダプタ・controller・DI 配線）の 3 層。domain と application は Nest / TypeORM を import しない純 TypeScript
- **理由**: ユースケースをポートのモックだけでユニットテストできる。一方、ユースケースが数本の規模で教科書どおりの 4 層（interface-adapters / frameworks を厳密分離）にするとファイルが薄くなり過剰設計になるため、説明できる最小限の 3 層に留めた

### 5. Geocoder をポートにして Google と国土地理院を差し替え可能にする

- **決定**: domain に `Geocoder` インターフェースを置き、`GoogleGeocoder` と `GsiGeocoder`（国土地理院の逆ジオ API、キー不要）の 2 実装を用意。`GOOGLE_GEOCODING_API_KEY` が空なら Nest Module が `GsiGeocoder` を DI する
- **理由**: キーが無い環境（審査環境を含む）でも住所表示まで動く。差し替え可能性をクリーンアーキテクチャの具体例として示せる

### 6. Google キーを 2 本に分け、ブラウザ用キーは実行時に渡す

- **決定**: ブラウザに出る地図用キー（`GOOGLE_MAPS_BROWSER_KEY`、HTTP リファラ制限）と、ブラウザに出ない逆ジオ用キー（`GOOGLE_GEOCODING_API_KEY`、Geocoding API のみ）を分ける。ブラウザ用キーは `NEXT_PUBLIC_` にせず、Server Component が実行時に `process.env` から読んで props で渡す。API の転送先 `API_URL` も同じ理由で next.config の `rewrites()` ではなく `src/proxy.ts` がリクエストごとに読む
- **理由**: 漏れても困らない権限と、漏らしてはいけない権限を分離する。`NEXT_PUBLIC_` はビルド時にバンドルへ焼き込まれ、`rewrites()` の宛先も standalone ビルドの `server.js` に焼き込まれる（実測して確認）。キーや接続先を変えるたびにイメージの再ビルドが必要になるのを避け、`.env` を書き換えてコンテナを再起動するだけで反映されるようにした

### 7. シードは API 起動時に冪等 upsert

- **決定**: api コンテナの起動処理で「マイグレーション実行 → `backend/seed/spots.csv` を `name` をキーに `ON CONFLICT DO UPDATE ... WHERE (...) IS DISTINCT FROM (EXCLUDED...)` で upsert → サーバー起動」。ログに `inserted / updated / unchanged` の件数を出す
- **理由**: Postgres の initdb で COPY するより、アプリのドメイン検証を通して投入したと説明できる。何度再起動しても二重投入されず、内容が同じなら `updated_at` も含めて 1 行も書き換えない（2 回目の起動ログは `unchanged=200`）。CSV を直せば次回起動で差分だけ反映される

### 8. `docker compose up` 一発で壊れにくくする

- **決定**: 各サービスはマルチステージビルドの本番イメージで起動（ボリュームマウントの dev サーバーにしない）。`db` は `pg_isready`、`api` は `/health` の healthcheck を持ち、`depends_on: condition: service_healthy` で起動順を保証。compose の変数は `${VAR:-既定値}` で参照し、`env_file` は使わない
- **理由**: 審査側の環境差で壊れにくくする。`.env` が無くても起動でき、マイグレーション前に API が DB に接続しようとして落ちることもない。コンテナ間の接続先（`DATABASE_URL` のホスト `db`、web → api の `http://api:3001`）は compose 内で固定し、ローカル開発用の `.env`（`localhost`）が混ざっても壊れないようにした。api は IPv4 / IPv6 両方で listen し、healthcheck は `127.0.0.1` を明示する（コンテナ内で `localhost` が `::1` に解決されて healthcheck だけ失敗する問題をレビューで検出した）

### 9. リストは「半径内の検索結果」と一致させる

- **決定**: リストに出すのは半径検索の結果そのもの。マーカークリックでリストの該当項目をハイライトしてスクロール、リストクリックで地図をその地点へパンする
- **理由**: 地図の表示範囲（ビューポート）と連動させるより仕様が単純で、半径検索と整合する。ユーザーにとっても「円の中にあるもの = リスト」で分かりやすい
- **補足**: 検索中心を動かすのはユーザーの地図操作だけ。リストクリックによるパンでは再検索しない（パン後の `idle` を 1 回捨てる）。再検索するとリストが距離順に並び替わり、押した項目が指の下から消えてしまうため

### 検討して採用しなかった案

| 案 | 採用しなかった理由 |
|---|---|
| フロント完結（200 件を全部ブラウザへ送り JS で距離計算） | 課題の意図「データ設計への配慮」に応えられず、「件数が少ないから」以上の説明ができない |
| PostGIS + Nest のメモリ内 LRU キャッシュ | コンテナ再起動でキャッシュが消える。Postgres に永続化する案との工数差が小さい |
| 教科書型 4 層クリーンアーキテクチャ | ユースケース数本ではファイルが薄くなり過剰設計になる |
| Nest 標準構成 + リポジトリ層のみ | ドメインとフレームワークの分離が弱く、ユースケースの単体テストがしにくい |
| MapLibre + 国土地理院（キー不要構成） | 審査側がキー無しで地図まで動かせる利点はあるが、地図は Google Maps を採用。国土地理院は逆ジオのフォールバックとして残した |

---

## 時間が足りず実装を簡略化した箇所や、今後の改善点

| 簡略化した点 | 現状 | 今後の改善 |
|---|---|---|
| **検索方式を半径検索に統一** | 地図の表示範囲（ビューポート）ではなく、中心からの半径で検索している | 表示範囲内を検索する `ST_MakeEnvelope` + `&&` 演算子のエンドポイントを追加し、モードを切り替えられるようにする |
| **ページング無し** | 200 件規模を前提に、半径内の全件を一度に返している（`radiusKm` 上限 50km で件数を抑制） | 件数上限 + カーソル（距離・id）によるページング、リストの仮想スクロール |
| **ブラウザ E2E テスト無し** | バックエンドはユニット / controller e2e / 実 DB 統合テストまで。フロントは純関数のユニットテストのみで、地図操作を含む E2E は無い | Playwright で「地図移動 → リスト更新 → 住所表示」を自動化。統合テストは Testcontainers で DB 起動まで自動化 |
| **キャッシュの掃除ジョブ無し** | TTL を過ぎた `geocode_cache` 行は再取得時に upsert で上書きされるだけで、参照されない行は残り続ける | `fetched_at` で古い行を定期削除するジョブ（`@nestjs/schedule` など）を追加 |
| **認証無し** | API は誰でも呼べる。外部 API を呼ぶ `/geocode/reverse` もレート制限なし | 認証、`@nestjs/throttler` によるレート制限 |
| **地図はキー必須** | 国土地理院へのフォールバックは逆ジオのみ。ブラウザ用キーが無いと地図タイルは出ない（リスト・住所は動く） | キー未設定時は MapLibre + 地理院タイルで地図を出す |
| **UI は最低限** | モバイル最適化・i18n・デザインの作り込みはしていない | レスポンシブ対応、スポット詳細表示 |
| **国土地理院フォールバックの市区町村名は首都圏のみ** | 国土地理院 API は市区町村コードと町字名しか返さないため、コード → 名称の対応表を同梱している。東京都全域と神奈川・埼玉・千葉の主要市は網羅したが、シードには大阪・沖縄など全国の地点も含まれるため、地方では「梅田三丁目」のように町字名だけになる | 全国の市区町村コード表（総務省）を同梱するか、Google キーを設定する |
| **同じ地点への同時リクエストをまとめない** | キャッシュミス時に同じグリッドへ並行して来たリクエストは、それぞれ外部 API を呼ぶ（結果は upsert なので壊れない） | single-flight（進行中の Promise を共有）を `ReverseGeocodeUseCase` の手前に置く |
| **`/health` は DB を見ない** | プロセスが生きていれば ok を返す | `SELECT 1` を含める。ただし DB 断で api が再起動ループに入らないよう readiness と liveness を分ける |
| **CSV パーサは簡易実装** | 引用符内の改行に非対応。今回の CSV には無い | csv-parse 等のライブラリに置き換える |
| **API 転送は Next.js の proxy（middleware）** | 応答ヘッダ `x-middleware-rewrite` に内部の転送先（`http://api:3001/...`）が出る。api 停止時は 502 でなく本文なしの 500 になる | Route Handler（`app/api/[...path]/route.ts`）で fetch を中継し、ヘッダ・エラー応答・タイムアウトを制御する |
| **検索中心もグリッドに丸める** | 再検索の抑制とキャッシュ再利用のため、半径検索の中心を逆ジオと同じ約 100m グリッドに丸めている。地図の十字（実際の中心）と検索の中心が最大約 70m ずれ、距離表示も同じだけずれる。半径円は丸めた中心に描くので「円の中 = リスト」は保たれる | 再検索の判定（グリッド）と検索に使う座標の精度を分ける。または半径に応じて丸め桁数を変える |
| **シードは追加・更新のみ** | `name` をキーにした upsert なので、CSV から行を消したり名前を直したりしても古い行は DB に残る（`docker compose down -v` で作り直せば揃う） | CSV に無い行を削除する同期モード、または CSV に安定した ID 列を持たせる |
| **キャッシュ用テーブルの障害が API に波及する** | `geocode_cache` の読み書きが失敗すると、外部 API から住所が取れていても 500 になる | キャッシュの失敗はログに留め、取得した住所を返す |
| **DB 接続リトライが一律** | 起動時の接続は原因を区別せず 2 秒間隔で 30 回リトライする。パスワード間違いのような即時に分かる設定ミスでも 60 秒待つ | 接続拒否・起動中のみリトライし、認証エラーは即終了する |
| **実キーでの地図描画は未検証の部分がある** | 開発中は Google キー無しで進めたため、マーカー・クラスタ・半径円・パンの実描画は自動テストに含まれない | Playwright + テスト用キーで地図操作の E2E を追加 |
| **本番運用の考慮** | 本番デプロイ・CI/CD は対象外。ホスト側ポート 3000 / 3001 / 5432 は固定 | GitHub Actions で lint / test / イメージビルドを回す。ポートを環境変数で上書き可能にする |
