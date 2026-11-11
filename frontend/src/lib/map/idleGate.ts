/**
 * 地図の idle（移動終了）を「ユーザー操作によるもの」だけ通すためのゲート。
 * リスト由来の panTo の前に `expectProgrammaticMove()` を呼ぶと、その移動が終わった idle を 1 回だけ捨てる。
 * ユーザーがドラッグ / ズームを始めたら `userGesture()` で解除する
 * （panTo で地図が動かず idle が来なかったときに、フラグが残って次のユーザー操作を食わないように）。
 */
export type IdleGate = {
  expectProgrammaticMove: () => void;
  userGesture: () => void;
  /** この idle を検索中心の更新に使ってよければ true */
  consumeIdle: () => boolean;
};

export function createIdleGate(): IdleGate {
  let skipNext = false;
  return {
    expectProgrammaticMove: () => {
      skipNext = true;
    },
    userGesture: () => {
      skipNext = false;
    },
    consumeIdle: () => {
      if (!skipNext) return true;
      skipNext = false;
      return false;
    },
  };
}
