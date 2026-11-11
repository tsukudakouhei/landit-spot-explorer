# よく使うコマンドの短縮。make が無い環境では右側のコマンドをそのまま実行すればよい。
.PHONY: help env up down reset logs ps config test-api

help: ## コマンド一覧
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*## "}{printf "  %-10s %s\n",$$1,$$2}'

env: ## .env.example から .env を作る（既存の .env は上書きしない）
	@test -f .env && echo ".env already exists" || cp .env.example .env

up: ## ビルドして起動（http://localhost:3000）
	docker compose up --build

down: ## 停止（DB データは残す）
	docker compose down

reset: ## 停止して DB ボリュームも削除（次回起動で migration + seed をやり直す）
	docker compose down -v

logs: ## api / web のログを追う
	docker compose logs -f api web

ps: ## コンテナとヘルスチェックの状態
	docker compose ps

config: ## compose 定義の検証
	docker compose config -q && echo "compose config OK"

test-api: ## backend のユニットテスト（ホストの Node 22 で実行）
	cd backend && npm ci && npm test
