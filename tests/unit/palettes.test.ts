import { describe, it, expect } from "vitest";
import { FIXED_PALETTES } from "../../src/engine/palettes/fixed";
import {
  extractMedianCut,
  extractPopularity,
  extractLuminance,
} from "../../src/engine/palettes/extract";
import { createGradientImage } from "../helpers/images";

describe("固定パレット", () => {
  const entries = Object.entries(FIXED_PALETTES);

  it("8種類が定義されている", () => {
    expect(entries.map(([name]) => name).sort()).toEqual([
      "cool",
      "famicom",
      "forest",
      "gameboy",
      "grayscale",
      "sunset",
      "vivid",
      "warm",
    ]);
  });

  it.each(entries)("%s: ちょうど16色", (_name, palette) => {
    expect(palette.length).toBe(16);
  });

  it.each(entries)("%s: 重複色がない（旧gameboyバグの再発防止）", (_name, palette) => {
    const keys = new Set(palette.map((c) => `${c.r},${c.g},${c.b}`));
    expect(keys.size).toBe(16);
  });

  it.each(entries)("%s: 全チャンネルが0-255の整数", (_name, palette) => {
    for (const c of palette) {
      for (const v of [c.r, c.g, c.b]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("自動パレット抽出", () => {
  const image = createGradientImage(64, 64);
  const methods = [
    ["mediancut", extractMedianCut],
    ["popularity", extractPopularity],
    ["luminance", extractLuminance],
  ] as const;

  it.each(methods)("%s: 指定色数ちょうどを返す", (_name, extract) => {
    for (const n of [4, 8, 16, 32]) {
      expect(extract(image, n).length).toBe(n);
    }
  });

  it.each(methods)("%s: 決定的（同じ入力→同じパレット）", (_name, extract) => {
    expect(extract(image, 16)).toEqual(extract(image, 16));
  });

  it.each(methods)("%s: 全色が0-255の範囲内", (_name, extract) => {
    for (const c of extract(image, 16)) {
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });

  it("単色画像でも安全に動作する", () => {
    const flat = createGradientImage(1, 1);
    for (const [, extract] of methods) {
      expect(extract(flat, 16).length).toBe(16);
    }
  });
});
