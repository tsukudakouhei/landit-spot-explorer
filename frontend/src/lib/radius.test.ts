import { describe, expect, it } from "vitest";
import { MAX_RADIUS_KM, formatRadius, nextWiderRadius } from "./radius";

describe("nextWiderRadius", () => {
  it("今の倍を提案する", () => {
    expect(nextWiderRadius(0.5)).toBe(1);
    expect(nextWiderRadius(2)).toBe(4);
    expect(nextWiderRadius(2.5)).toBe(5);
  });

  it("上限を超えない", () => {
    expect(nextWiderRadius(6)).toBe(MAX_RADIUS_KM);
    expect(nextWiderRadius(9.5)).toBe(MAX_RADIUS_KM);
  });

  it("すでに上限なら null", () => {
    expect(nextWiderRadius(MAX_RADIUS_KM)).toBeNull();
  });
});

describe("formatRadius", () => {
  it("整数は小数を付けない", () => {
    expect(formatRadius(5)).toBe("5 km");
    expect(formatRadius(10)).toBe("10 km");
  });

  it("端数は小数第 1 位まで", () => {
    expect(formatRadius(0.5)).toBe("0.5 km");
    expect(formatRadius(2.5)).toBe("2.5 km");
  });
});
