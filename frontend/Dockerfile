# syntax=docker/dockerfile:1

# ---- deps: 依存だけ先に入れてレイヤーキャッシュを効かせる ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: next build（output: 'standalone'） ----
# API_URL / GOOGLE_MAPS_BROWSER_KEY はここでは渡さない。どちらも実行時に読む設計（src/proxy.ts, src/app/page.tsx）
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- runner: standalone 出力だけを載せた最小イメージ ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    API_URL=http://api:3001
# GOOGLE_MAPS_BROWSER_KEY は docker run -e / compose の environment で実行時に渡す（未設定なら案内パネル）

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 3000
CMD ["node", "server.js"]
