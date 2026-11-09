import { describe, expect, it } from "vitest";
import { formatDistance, isSameGrid, parseGridDecimals, resolveNextCenter, roundCoord, toGridKey } from "./geo";

describe("roundCoord", () => {
  it("既定で小数第3位に丸める", () => {
    expect(roundCoord(35.681236, 139.767125)).toEqual({ lat: 35.681, lng: 139.767 });
  });

  it("四捨五入する（切り捨てではない）", () => {
    expect(roundCoord(35.6816, 139.7674)).toEqual({ lat: 35.682, lng: 139.767 });
  });

  it("桁数を指定できる", () => {
    expect(roundCoord(35.681236, 139.767125, 2)).toEqual({ lat: 35.68, lng: 139.77 });
    expect(roundCoord(35.681236, 139.767125, 0)).toEqual({ lat: 36, lng: 140 });
  });

  it("負の座標も丸められる", () => {
    expect(roundCoord(-33.86882, -151.20929)).toEqual({ lat: -33.869, lng: -151.209 });
  });

  it("負の .5 はバックエンドと同じく絶対値で四捨五入する（0 方向に寄せない）", () => {
    // Math.round だけだと -0.5 → -0, -1.5 → -1 になり、サーバーの gridKey とずれる
    expect(roundCoord(-0.5, -1.5, 0)).toEqual({ lat: -1, lng: -2 });
    expect(roundCoord(-0.25, -139.75, 1)).toEqual({ lat: -0.3, lng: -139.8 });
    expect(roundCoord(0.25, 139.75, 1)).toEqual({ lat: 0.3, lng: 139.8 });
  });

  it("0 付近の負数は -0 ではなく 0 にする（キーが割れない）", () => {
    const r = roundCoord(-0.0004, -0.0001);
    expect(Object.is(r.lat, 0)).toBe(true);
    expect(Object.is(r.lng, 0)).toBe(true);
  });

  it("緯度経度の端（±90 / ±180）はそのまま", () => {
    expect(roundCoord(90, 180)).toEqual({ lat: 90, lng: 180 });
    expect(roundCoord(-90, -180)).toEqual({ lat: -90, lng: -180 });
  });
});

describe("parseGridDecimals", () => {
  it("1〜6 の整数はそのまま使う", () => {
    expect(parseGridDecimals("1")).toBe(1);
    expect(parseGridDecimals("4")).toBe(4);
    expect(parseGridDecimals(" 6 ")).toBe(6);
  });

  it("未設定・空・範囲外・小数・数字以外は既定の 3", () => {
    for (const raw of [undefined, "", "0", "7", "2.5", "-1", "abc", "3km"]) {
      expect(parseGridDecimals(raw)).toBe(3);
    }
  });
});

describe("toGridKey", () => {
  it("バックエンドの gridKey と同じ形式（末尾ゼロも桁を揃える）", () => {
    expect(toGridKey({ lat: 35.681236, lng: 139.767125 })).toBe("35.681:139.767");
    expect(toGridKey({ lat: 35.7, lng: 139.8 })).toBe("35.700:139.800");
  });

  it("-0 を含まない", () => {
    expect(toGridKey({ lat: -0.0001, lng: 0.0001 })).toBe("0.000:0.000");
  });
});

describe("isSameGrid", () => {
  it("グリッド内の微小移動は同じキー", () => {
    expect(isSameGrid({ lat: 35.6812, lng: 139.7671 }, { lat: 35.6814, lng: 139.7674 })).toBe(true);
  });

  it("丸め境界をまたぐと別キー（0.0005 の差でも）", () => {
    expect(isSameGrid({ lat: 35.6814, lng: 139.767 }, { lat: 35.6816, lng: 139.767 })).toBe(false);
  });

  it("経度だけ変わっても別キー", () => {
    expect(isSameGrid({ lat: 35.681, lng: 139.767 }, { lat: 35.681, lng: 139.768 })).toBe(false);
  });
});

describe("resolveNextCenter", () => {
  const prev = roundCoord(35.681236, 139.767125);

  it("同じグリッドなら prev と同一参照を返す（state 更新 → 再検索が起きない）", () => {
    expect(resolveNextCenter(prev, { lat: 35.6809, lng: 139.7672 })).toBe(prev);
  });

  it("グリッドが変わったら丸めた新しい座標を返す", () => {
    const next = resolveNextCenter(prev, { lat: 35.69012, lng: 139.70034 });
    expect(next).not.toBe(prev);
    expect(next).toEqual({ lat: 35.69, lng: 139.7 });
  });
});

describe("formatDistance", () => {
  it("1km 未満は m 表記で整数に丸める", () => {
    expect(formatDistance(0)).toBe("0 m");
    expect(formatDistance(123.4)).toBe("123 m");
    expect(formatDistance(999.4)).toBe("999 m");
  });

  it("1km 以上は km 表記で小数1位", () => {
    expect(formatDistance(1000)).toBe("1.0 km");
    expect(formatDistance(1549)).toBe("1.5 km");
  });
});
