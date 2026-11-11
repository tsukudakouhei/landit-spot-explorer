// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CENTER_DEBOUNCE_MS, useSearchCenter } from "./useSearchCenter";

const TOKYO = { lat: 35.681236, lng: 139.767125 };

describe("useSearchCenter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("初期値は丸めた座標", () => {
    const { result } = renderHook(() => useSearchCenter(TOKYO));
    expect(result.current.center).toEqual({ lat: 35.681, lng: 139.767 });
  });

  it("idle が続く間は確定せず、最後の提案から 400ms 後に 1 回だけ確定する", () => {
    const { result } = renderHook(() => useSearchCenter(TOKYO));

    act(() => {
      result.current.propose({ lat: 35.69, lng: 139.7 });
      vi.advanceTimersByTime(CENTER_DEBOUNCE_MS - 1);
      result.current.propose({ lat: 35.7012, lng: 139.7745 }); // 400ms 経つ前に次の移動 → タイマーやり直し
      vi.advanceTimersByTime(CENTER_DEBOUNCE_MS - 1);
    });
    expect(result.current.center).toEqual({ lat: 35.681, lng: 139.767 });

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.center).toEqual({ lat: 35.701, lng: 139.775 });
  });

  it("同じグリッド内の移動では center の参照が変わらない（＝再検索しない）", () => {
    const { result } = renderHook(() => useSearchCenter(TOKYO));
    const before = result.current.center;

    act(() => {
      result.current.propose({ lat: 35.6812, lng: 139.7668 });
      vi.advanceTimersByTime(CENTER_DEBOUNCE_MS);
    });
    expect(result.current.center).toBe(before);
  });

  it("丸め桁数を指定できる", () => {
    const { result } = renderHook(() => useSearchCenter(TOKYO, 2));
    expect(result.current.center).toEqual({ lat: 35.68, lng: 139.77 });
  });

  it("commit は debounce せず即座に確定する", () => {
    const { result } = renderHook(() => useSearchCenter(TOKYO));
    act(() => result.current.commit({ lat: 34.70253, lng: 135.49597 }));
    expect(result.current.center).toEqual({ lat: 34.703, lng: 135.496 });
  });
});
