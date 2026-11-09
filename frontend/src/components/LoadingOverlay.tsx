/**
 * リスト上部の細いローディングバー。高さは常に確保しておき、表示/非表示でレイアウトを跳ねさせない。
 * 結果は前回のまま出し続けるので、全面を覆うオーバーレイにはしない。
 */
export function LoadingOverlay({ active }: { active: boolean }) {
  return (
    <div className="relative h-0.5 w-full shrink-0 overflow-hidden bg-transparent" aria-hidden="true">
      {active && (
        <div className="absolute inset-y-0 left-0 w-2/5 bg-blue-600 motion-safe:animate-loading-bar" />
      )}
    </div>
  );
}
