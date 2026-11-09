import { describe, expect, it } from "vitest";
import { createIdleGate } from "./idleGate";

describe("createIdleGate", () => {
  it("通常の idle（ユーザーの地図操作）は通す", () => {
    const gate = createIdleGate();
    expect(gate.consumeIdle()).toBe(true);
    expect(gate.consumeIdle()).toBe(true);
  });

  it("リスト由来の panTo の後の idle を 1 回だけ捨て、次からは通す", () => {
    const gate = createIdleGate();
    gate.expectProgrammaticMove();
    expect(gate.consumeIdle()).toBe(false); // panTo 完了の idle → 再検索しない
    expect(gate.consumeIdle()).toBe(true); // その後のユーザー操作 → 再検索する
  });

  it("panTo の idle が来る前にユーザーが操作したら解除する（フラグを残さない）", () => {
    const gate = createIdleGate();
    gate.expectProgrammaticMove();
    gate.userGesture();
    expect(gate.consumeIdle()).toBe(true);
  });
});
