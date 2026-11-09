import { useEffect, useState } from "react";

/** 値が `delayMs` 変化しなくなってから追従する。スライダーのドラッグ中に毎ステップ API を叩かないために使う */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
