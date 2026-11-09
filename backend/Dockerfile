# syntax=docker/dockerfile:1

# ---- deps: ビルドに必要な依存（devDependencies 含む）----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: TypeScript をコンパイル ----
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- runner: 本番依存とビルド成果物だけを持つ実行イメージ ----
FROM node:22-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# dist にはコンパイル済みのマイグレーション（dist/infrastructure/persistence/typeorm/migrations）も含まれる
COPY --from=build /app/dist ./dist
COPY seed ./seed
COPY docker-entrypoint.sh ./
USER node
EXPOSE 3001
CMD ["sh", "./docker-entrypoint.sh"]
