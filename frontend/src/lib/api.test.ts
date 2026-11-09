import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  buildCategoriesUrl,
  buildReverseGeocodeUrl,
  buildSpotsSearchUrl,
  reverseGeocode,
  searchSpots,
} from "./api";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("URL 組み立て", () => {
  it("検索 URL は同一オリジンの /api 配下で、category 無しならパラメータを付けない", () => {
    expect(buildSpotsSearchUrl({ lat: 35.681, lng: 139.767, radiusKm: 2 })).toBe(
      "/api/spots/search?lat=35.681&lng=139.767&radiusKm=2",
    );
    expect(buildSpotsSearchUrl({ lat: 35.681, lng: 139.767, radiusKm: 2, category: null })).toBe(
      "/api/spots/search?lat=35.681&lng=139.767&radiusKm=2",
    );
  });

  it("category はエンコードして付ける", () => {
    const url = buildSpotsSearchUrl({ lat: 35.681, lng: 139.767, radiusKm: 0.5, category: "観光名所" });
    expect(url).toBe(
      `/api/spots/search?lat=35.681&lng=139.767&radiusKm=0.5&category=${encodeURIComponent("観光名所")}`,
    );
    expect(new URLSearchParams(url.split("?")[1]).get("category")).toBe("観光名所");
  });

  it("カテゴリ一覧・逆ジオの URL", () => {
    expect(buildCategoriesUrl()).toBe("/api/spots/categories");
    expect(buildReverseGeocodeUrl(-33.869, 151.209)).toBe("/api/geocode/reverse?lat=-33.869&lng=151.209");
  });
});

describe("fetch ラッパ", () => {
  it("200 なら JSON をそのまま返し、組み立てた URL を叩く", async () => {
    const body = { items: [], total: 0, center: { lat: 35.681, lng: 139.767 }, radiusKm: 2 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchSpots({ lat: 35.681, lng: 139.767, radiusKm: 2 })).resolves.toEqual(body);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/spots/search?lat=35.681&lng=139.767&radiusKm=2",
      expect.objectContaining({ headers: { Accept: "application/json" } }),
    );
  });

  it("4xx は ApiError を投げ、Nest の message 配列を文言に含める", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ statusCode: 400, message: ["lat must not be greater than 90"], error: "Bad Request" }, 400),
      ),
    );

    const error = await searchSpots({ lat: 91, lng: 0, radiusKm: 2 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toContain("lat must not be greater than 90");
  });

  it("5xx で本文が JSON でなくても ApiError を投げる", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Bad Gateway", { status: 502 })));

    await expect(reverseGeocode(35.681, 139.767)).rejects.toMatchObject({
      name: "ApiError",
      status: 502,
      message: "API エラー (502)",
    });
  });

  it("ネットワークエラーは status 0 の ApiError に包む", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));

    await expect(reverseGeocode(35.681, 139.767)).rejects.toMatchObject({ name: "ApiError", status: 0 });
  });

  it("中断（AbortError）は包まずにそのまま投げる（TanStack Query がキャンセルとして扱う）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")));

    await expect(reverseGeocode(35.681, 139.767)).rejects.toMatchObject({ name: "AbortError" });
  });
});
