import { describe, expect, it } from "vitest";
import { AREAS } from "./areas";
import { INITIAL_CENTER, toGridKey } from "./geo";

describe("AREAS", () => {
  it("id が重複しない", () => {
    expect(new Set(AREAS.map((a) => a.id)).size).toBe(AREAS.length);
  });

  it("座標が緯度経度の範囲に収まる", () => {
    for (const { center } of AREAS) {
      expect(center.lat).toBeGreaterThanOrEqual(-90);
      expect(center.lat).toBeLessThanOrEqual(90);
      expect(center.lng).toBeGreaterThanOrEqual(-180);
      expect(center.lng).toBeLessThanOrEqual(180);
    }
  });

  it("どのエリアも別のグリッドにある（同時に 2 つが選択中にならない）", () => {
    expect(new Set(AREAS.map((a) => toGridKey(a.center))).size).toBe(AREAS.length);
  });

  it("初期位置（東京駅）を含む", () => {
    expect(AREAS.some((a) => toGridKey(a.center) === toGridKey(INITIAL_CENTER))).toBe(true);
  });
});
