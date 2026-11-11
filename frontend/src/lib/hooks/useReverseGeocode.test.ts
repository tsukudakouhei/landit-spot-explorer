import { describe, expect, it } from "vitest";
import type { ReverseGeocodeResponse } from "@/lib/api";
import { isAddressUnavailable, resolveGeocodeStatus } from "./useReverseGeocode";

const base = { provider: "gsi" as const, gridKey: "35.681:139.767" };
const res = (r: Pick<ReverseGeocodeResponse, "address" | "cached" | "status">): ReverseGeocodeResponse => ({
  ...base,
  ...r,
});

describe("isAddressUnavailable", () => {
  it("status:unavailable のときだけ true（保持せず再試行を出す）", () => {
    expect(isAddressUnavailable(res({ address: null, cached: false, status: "unavailable" }))).toBe(true);
  });

  it("not_found（海上など）は cached の真偽に関係なく false", () => {
    expect(isAddressUnavailable(res({ address: null, cached: false, status: "not_found" }))).toBe(false);
    expect(isAddressUnavailable(res({ address: null, cached: true, status: "not_found" }))).toBe(false);
  });

  it("found と undefined は false", () => {
    expect(isAddressUnavailable(res({ address: "東京都千代田区", cached: false, status: "found" }))).toBe(false);
    expect(isAddressUnavailable(undefined)).toBe(false);
  });
});

describe("resolveGeocodeStatus", () => {
  it("status があればそのまま使う", () => {
    expect(resolveGeocodeStatus(res({ address: null, cached: false, status: "unavailable" }))).toBe("unavailable");
  });

  it("status が無い古い応答は、住所ありなら found、無ければ not_found に倒す", () => {
    expect(resolveGeocodeStatus(res({ address: "東京都千代田区", cached: true }))).toBe("found");
    expect(resolveGeocodeStatus(res({ address: null, cached: false }))).toBe("not_found");
  });
});
