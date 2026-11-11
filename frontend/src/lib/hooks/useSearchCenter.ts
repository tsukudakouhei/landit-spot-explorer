import { useCallback, useEffect, useRef, useState } from "react";
import { GRID_DECIMALS, roundCoord, resolveNextCenter, type LatLng } from "@/lib/geo";

export const CENTER_DEBOUNCE_MS = 400;

/**
 * 「検索中心」を管理する。地図の idle ごとに `propose` を呼ぶと、
 * 400ms 動きが止まったところで丸めた座標を確定する。丸めたキーが前回と同じなら state を更新しない。
 */
export function useSearchCenter(initial: LatLng, decimals: number = GRID_DECIMALS) {
  const [center, setCenter] = useState<LatLng>(() => roundCoord(initial.lat, initial.lng, decimals));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** debounce 付きで中心を提案する（地図の idle 用） */
  const propose = useCallback(
    (next: LatLng) => {
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setCenter((prev) => resolveNextCenter(prev, next, decimals));
      }, CENTER_DEBOUNCE_MS);
    },
    [cancel, decimals],
  );

  /** debounce せずに即座に中心を変える（キー未設定時の座標入力用） */
  const commit = useCallback(
    (next: LatLng) => {
      cancel();
      setCenter((prev) => resolveNextCenter(prev, next, decimals));
    },
    [cancel, decimals],
  );

  useEffect(() => cancel, [cancel]);

  return { center, propose, commit };
}
