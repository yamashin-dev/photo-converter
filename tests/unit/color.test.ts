import { describe, it, expect } from "vitest";
import { colorDistanceSq, findClosestIndex, clamp255 } from "../../src/engine/color";
import type { Palette } from "../../src/engine/types";

describe("colorDistanceSq", () => {
  it("同一色は距離0", () => {
    expect(colorDistanceSq({ r: 10, g: 20, b: 30 }, { r: 10, g: 20, b: 30 })).toBe(0);
  });

  it("ユークリッド距離の2乗を返す（マンハッタン距離ではない）", () => {
    // 旧実装のバグ再発防止: sum(|Δ|) ではなく sum(Δ²) であること
    const d = colorDistanceSq({ r: 0, g: 0, b: 0 }, { r: 3, g: 4, b: 0 });
    expect(d).toBe(25); // 3² + 4² = 25（マンハッタンなら7）
  });

  it("黒と白の距離", () => {
    expect(colorDistanceSq({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 })).toBe(
      255 * 255 * 3
    );
  });
});

describe("findClosestIndex", () => {
  const palette: Palette = [
    { r: 0, g: 0, b: 0 },
    { r: 128, g: 128, b: 128 },
    { r: 255, g: 255, b: 255 },
  ];

  it("完全一致する色のインデックスを返す", () => {
    expect(findClosestIndex({ r: 128, g: 128, b: 128 }, palette)).toBe(1);
  });

  it("最も近い色を選ぶ", () => {
    expect(findClosestIndex({ r: 10, g: 5, b: 0 }, palette)).toBe(0);
    expect(findClosestIndex({ r: 250, g: 240, b: 255 }, palette)).toBe(2);
  });
});

describe("clamp255", () => {
  it("範囲内はそのまま丸める", () => {
    expect(clamp255(127.6)).toBe(128);
  });
  it("負値は0、255超は255", () => {
    expect(clamp255(-5)).toBe(0);
    expect(clamp255(300)).toBe(255);
  });
});
