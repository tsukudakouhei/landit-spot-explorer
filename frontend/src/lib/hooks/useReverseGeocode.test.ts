import { describe, expect, it } from "vitest";
import { isUnresolvedAddress } from "./useReverseGeocode";

describe("isUnresolvedAddress", () => {
  const base = { provider: "gsi" as const, gridKey: "35.681:139.767" };

  it("address:null かつ cached:false は「今回取れなかった」扱い（保持しない）", () => {
    expect(isUnresolvedAddress({ ...base, address: null, cached: false })).toBe(true);
  });

  it("cached:true の null（海上など確定済み）や住所ありは通常どおり", () => {
    expect(isUnresolvedAddress({ ...base, address: null, cached: true })).toBe(false);
    expect(isUnresolvedAddress({ ...base, address: "東京都千代田区", cached: false })).toBe(false);
    expect(isUnresolvedAddress(undefined)).toBe(false);
  });
});
