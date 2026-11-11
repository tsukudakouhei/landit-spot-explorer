import { NextResponse, type NextRequest } from "next/server";

/** ローカル開発（`npm run dev`）用の既定値。Docker イメージでは ENV API_URL=http://api:3001 が入る */
const DEFAULT_API_URL = "http://localhost:3001";

/**
 * ブラウザは常に同一オリジンの `/api/...` を叩き、ここで `${API_URL}/...` に転送する（CORS 不要）。
 * Proxy はリクエストごとに実行されるので、API_URL は実行時の環境変数がそのまま効く。
 */
export function proxy(request: NextRequest) {
  const apiUrl = (process.env.API_URL || DEFAULT_API_URL).replace(/\/+$/, "");
  const upstreamPath = request.nextUrl.pathname.replace(/^\/api/, "") || "/";
  // new URL(path, base) は使わない: base のパス（例 http://gw/v1）が捨てられ、
  // path が "//evil" で始まるとホスト差し替えとして解釈されるため、文字列連結で組み立てる
  return NextResponse.rewrite(`${apiUrl}${upstreamPath}${request.nextUrl.search}`);
}

export const config = {
  matcher: "/api/:path*",
};
