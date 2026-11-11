import { describe, expect, it } from "vitest";
import { circleBounds } from "./circleBounds";

describe("circleBounds", () => {
  it("中心から南北に半径ぶんだけ広がる", () => {
    const b = circleBounds({ lat: 35, lng: 139 }, 111.32);
    expect(b.north).toBeCloseTo(36, 5);
    expect(b.south).toBeCloseTo(34, 5);
  });

  it("中心に対して東西・南北とも対称", () => {
    const center = { lat: 35.681, lng: 139.767 };
    const b = circleBounds(center, 2);
    expect((b.north + b.south) / 2).toBeCloseTo(center.lat, 9);
    expect((b.east + b.west) / 2).toBeCloseTo(center.lng, 9);
  });

  it("緯度が高いほど、同じ半径でも経度の幅が広くなる", () => {
    const tokyo = circleBounds({ lat: 35.68, lng: 139.77 }, 2);
    const sapporo = circleBounds({ lat: 43.06, lng: 141.35 }, 2);
    expect(sapporo.east - sapporo.west).toBeGreaterThan(tokyo.east - tokyo.west);
    // 赤道では経度と緯度の幅が同じ
    const equator = circleBounds({ lat: 0, lng: 0 }, 2);
    expect(equator.east - equator.west).toBeCloseTo(equator.north - equator.south, 9);
  });

  it("半径が大きいほど矩形も大きい", () => {
    const center = { lat: 35.68, lng: 139.77 };
    expect(circleBounds(center, 10).north).toBeGreaterThan(circleBounds(center, 2).north);
  });
});
