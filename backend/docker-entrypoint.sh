#!/bin/sh
# 起動シーケンス: マイグレーション → シード（冪等 upsert）→ API サーバー
# どれかが失敗したらコンテナごと落とし、中途半端な状態で listen しない
set -e

node dist/infrastructure/cli/migrate.js
node dist/infrastructure/cli/seed.js
exec node dist/main.js
