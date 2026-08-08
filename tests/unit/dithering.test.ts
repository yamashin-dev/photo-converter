import { describe, it, expect } from "vitest";
import { applyDitheringInPlace } from "../../src/engine/dithering";
import { FIXED_PALETTES } from "../../src/engine/palettes/fixed";
import { createRng } from "../../src/engine/random";
import { cloneImage } from "../../src/engine/image";
import type { DitheringType } from "../../src/engine/types";
import { createGradientImage, usesOnlyPaletteColors, imageHash } from "../helpers/images";

const ALL_TYPES: Exclude<DitheringType, "none">[] = [
  "floyd-steinberg",
  "riemersma",
  "ordered-2x2",
  "ordered-4x4",
  "ordered-8x8",
  "patterning-2x2",
  "patterning-4x4",
  "patterning-8x8",
];

const palette = FIXED_PALETTES.famicom;

describe("ディザリング共通の性質", () => {
  it.each(ALL_TYPES)("%s: 出力はパレット色のみで構成される", (type) => {
    const img = createGradientImage(32, 32);
    applyDitheringInPlace(img, palette, type, createRng(42));
    expect(usesOnlyPaletteColors(img, palette)).toBe(true);
  });

  it.each(ALL_TYPES)("%s: 決定的（同じシード→同じ出力）", (type) => {
    const a = createGradientImage(32, 32);
    const b = createGradientImage(32, 32);
    applyDitheringInPlace(a, palette, type, createRng(42));
    applyDitheringInPlace(b, palette, type, createRng(42));
    expect(imageHash(a)).toBe(imageHash(b));
  });

  it("none: 画像を変更しない", () => {
    const img = createGradientImage(16, 16);
    const before = cloneImage(img);
    applyDitheringInPlace(img, palette, "none", createRng(42));
    expect(img.data).toEqual(before.data);
  });
});

describe("Orderedディザリングのシード依存", () => {
  it("異なるシードではオフセットが変わり出力が変わりうる", () => {
    // シード1と2でオフセットが異なることを確認済みの組み合わせを使用
    const a = createGradientImage(33, 33);
    const b = createGradientImage(33, 33);
    applyDitheringInPlace(a, palette, "ordered-8x8", createRng(1));
    applyDitheringInPlace(b, palette, "ordered-8x8", createRng(2));
    // オフセットが偶然一致する可能性は8x8=64通り中1なので、
    // このテストが落ちる場合はシード選択を見直す
    expect(imageHash(a)).not.toBe(imageHash(b));
  });
});

describe("ゴールデン: 出力ハッシュの回帰検証", () => {
  // 出力が意図せず変わったことを検出する。アルゴリズムを意図的に変更した場合は
  // スナップショットを更新する（vitest -u）
  it.each(ALL_TYPES)("%s", (type) => {
    const img = createGradientImage(48, 48);
    applyDitheringInPlace(img, palette, type, createRng(42));
    expect(imageHash(img)).toMatchSnapshot();
  });
});
