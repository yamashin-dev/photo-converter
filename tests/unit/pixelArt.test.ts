import { describe, it, expect } from "vitest";
import { convertPixelArt } from "../../src/engine/styles/pixelArt";
import { FIXED_PALETTES } from "../../src/engine/palettes/fixed";
import type { ConversionParams, ConversionProgress } from "../../src/engine/types";
import { createGradientImage, usesOnlyPaletteColors, imageHash } from "../helpers/images";

function baseParams(overrides: Partial<ConversionParams> = {}): ConversionParams {
  return {
    style: "pixel-retro",
    pixelSize: 4,
    numColors: 16,
    paletteType: "famicom",
    extractMethod: "mediancut",
    dithering: "none",
    outline: "none",
    saturation: 100,
    enhanceContrast: false,
    removeShadow: false,
    seed: 42,
    ...overrides,
  };
}

describe("convertPixelArt: サイズ", () => {
  it("retro: 出力は元画像と同じサイズ", () => {
    const src = createGradientImage(100, 60);
    const out = convertPixelArt(src, baseParams());
    expect(out.width).toBe(100);
    expect(out.height).toBe(60);
  });

  it("integer: 出力は縮小サイズ×ピクセルサイズの整数倍", () => {
    const src = createGradientImage(100, 60);
    const out = convertPixelArt(src, baseParams({ style: "pixel-integer", pixelSize: 8 }));
    // small = floor(100/8)=12, floor(60/8)=7 → 出力 96x56
    expect(out.width).toBe(96);
    expect(out.height).toBe(56);
  });

  it("ピクセルサイズより小さい画像でも安全（最小1px）", () => {
    const src = createGradientImage(3, 3);
    const out = convertPixelArt(src, baseParams({ pixelSize: 16 }));
    expect(out.width).toBe(3);
    expect(out.height).toBe(3);
  });

  it("手描き風スタイルを渡すとエラー", () => {
    const src = createGradientImage(8, 8);
    expect(() => convertPixelArt(src, baseParams({ style: "illustration" }))).toThrow();
  });

  it("maxDimension超過時は処理前に縮小される（端末保護）", () => {
    const src = createGradientImage(200, 100);
    const out = convertPixelArt(src, baseParams({ maxDimension: 100 }));
    // 長辺200→100に縮小されるので出力も100x50
    expect(out.width).toBe(100);
    expect(out.height).toBe(50);
  });
});

describe("convertPixelArt: 実行時データのサニタイズ（旧PHPのフォールバック踏襲）", () => {
  it("型定義外のpaletteTypeはfamicomにフォールバックしてクラッシュしない", () => {
    const src = createGradientImage(32, 32);
    const params = baseParams({ paletteType: "存在しない値" as never });
    const out = convertPixelArt(src, params);
    expect(usesOnlyPaletteColors(out, FIXED_PALETTES.famicom)).toBe(true);
  });

  it("型定義外のextractMethodはmediancutにフォールバックしてクラッシュしない", () => {
    const src = createGradientImage(32, 32);
    const params = baseParams({ paletteType: "auto", extractMethod: "不正" as never });
    expect(() => convertPixelArt(src, params)).not.toThrow();
  });

  it("numColors=0や負値はクランプされてクラッシュしない", () => {
    const src = createGradientImage(32, 32);
    for (const n of [0, -5, 1, 1000, NaN]) {
      expect(() =>
        convertPixelArt(src, baseParams({ paletteType: "auto", numColors: n }))
      ).not.toThrow();
    }
  });

  it.each([
    ["auto", [0, 0, 0]],
    ["soft", [50, 50, 50]],
  ] as const)("outline='%s'はどのドットサイズでも画面を塗り潰さない", (outline, [r, g, b]) => {
    // 旧実装ではpixelSizeが大きいほど線が増え、autoは68%が黒、softは25%が灰色になっていた
    const src = createGradientImage(256, 192);
    for (const pixelSize of [2, 4, 8, 12, 16]) {
      const out = convertPixelArt(src, baseParams({ outline, pixelSize }));
      let painted = 0;
      for (let i = 0; i < out.data.length; i += 4) {
        if (out.data[i] === r && out.data[i + 1] === g && out.data[i + 2] === b) painted++;
      }
      expect(painted / (out.data.length / 4)).toBeLessThan(0.15);
    }
  });

  it("outline='soft'はソフト縁取り（auto=黒線とは異なる出力）", () => {
    const src = createGradientImage(64, 64);
    const soft = convertPixelArt(src, baseParams({ outline: "soft" }));
    const auto = convertPixelArt(src, baseParams({ outline: "auto" }));
    expect(imageHash(soft)).not.toBe(imageHash(auto));
    // ソフト縁取りの色(50,50,50)がどこかに存在する
    let hasSoftGray = false;
    for (let i = 0; i < soft.data.length; i += 4) {
      if (soft.data[i] === 50 && soft.data[i + 1] === 50 && soft.data[i + 2] === 50) {
        hasSoftGray = true;
        break;
      }
    }
    expect(hasSoftGray).toBe(true);
  });
});

describe("convertPixelArt: パレット遵守", () => {
  it("固定パレット+ディザなし: 出力はパレット16色のみ", () => {
    const src = createGradientImage(64, 64);
    const out = convertPixelArt(src, baseParams());
    expect(usesOnlyPaletteColors(out, FIXED_PALETTES.famicom)).toBe(true);
  });

  it("固定パレット+Floyd-Steinberg: 出力はパレット16色のみ", () => {
    const src = createGradientImage(64, 64);
    const out = convertPixelArt(src, baseParams({ dithering: "floyd-steinberg" }));
    expect(usesOnlyPaletteColors(out, FIXED_PALETTES.famicom)).toBe(true);
  });

  it("彩度変更+ディザなしでもパレット色のみ（レビュー指摘の回帰防止）", () => {
    const src = createGradientImage(64, 64);
    const out = convertPixelArt(src, baseParams({ paletteType: "gameboy", saturation: 150 }));
    expect(usesOnlyPaletteColors(out, FIXED_PALETTES.gameboy)).toBe(true);
  });

  it("autoパレット: 抽出色のみで構成される", () => {
    const src = createGradientImage(64, 64);
    const out = convertPixelArt(src, baseParams({ paletteType: "auto" }));
    // 出力の色数はnumColors以下
    const colors = new Set<number>();
    for (let i = 0; i < out.data.length; i += 4) {
      colors.add((out.data[i] << 16) | (out.data[i + 1] << 8) | out.data[i + 2]);
    }
    expect(colors.size).toBeLessThanOrEqual(16);
  });
});

describe("convertPixelArt: 決定性と進捗", () => {
  it("同じ入力・同じシード → 同じ出力", () => {
    const src = createGradientImage(64, 64);
    const p = baseParams({ dithering: "ordered-4x4", outline: "auto" });
    expect(imageHash(convertPixelArt(src, p))).toBe(imageHash(convertPixelArt(src, p)));
  });

  it("進捗コールバックが単調増加で1.0に到達する", () => {
    const src = createGradientImage(32, 32);
    const events: ConversionProgress[] = [];
    convertPixelArt(src, baseParams({ dithering: "floyd-steinberg" }), (p) => events.push(p));
    expect(events.length).toBeGreaterThan(0);
    for (let i = 1; i < events.length; i++) {
      expect(events[i].ratio).toBeGreaterThanOrEqual(events[i - 1].ratio);
    }
    expect(events[events.length - 1].ratio).toBe(1);
  });
});

describe("ゴールデン: パイプライン出力の回帰検証", () => {
  const cases: [string, Partial<ConversionParams>][] = [
    ["retro/famicom/ディザなし", {}],
    ["retro/auto-mediancut/FS", { paletteType: "auto", dithering: "floyd-steinberg" }],
    ["retro/gameboy/ordered-4x4", { paletteType: "gameboy", dithering: "ordered-4x4" }],
    ["integer/vivid/patterning-4x4", { style: "pixel-integer", paletteType: "vivid", dithering: "patterning-4x4", pixelSize: 8 }],
    ["retro/grayscale/アウトライン+彩度", { paletteType: "grayscale", outline: "auto", saturation: 150 }],
  ];

  it.each(cases)("%s", (_name, overrides) => {
    const src = createGradientImage(64, 48);
    const out = convertPixelArt(src, baseParams(overrides));
    expect(imageHash(out)).toMatchSnapshot();
  });
});
