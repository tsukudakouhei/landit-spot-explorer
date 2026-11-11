import type { NextConfig } from "next";

/**
 * `/api/*` → `${API_URL}/*` の転送は next.config の rewrites() ではなく src/proxy.ts で行う。
 * rewrites() の宛先は `next build` 時に routes-manifest.json と standalone/server.js へ
 * 焼き込まれるため、実行時に API_URL を差し替えられない（Docker イメージを再ビルドせずに
 * 環境ごとの API_URL を渡す、という要件を満たせない）。
 */
const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
