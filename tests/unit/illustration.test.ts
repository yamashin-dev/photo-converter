import { describe, it, expect } from "vitest";
import { convertIllustration, _internals } from "../../src/engine/styles/illustration";
import { extractKMeans } from "../../src/engine/palettes/kmeans";
import { createImage } from "../../src/engine/image";
import type { ConversionParams } from "../../src/engine/types";
import { createGradientImage, imageHash } from "../helpers/images";

function baseParams(overrides: Partial<ConversionParams> = {}): ConversionParams {
  return {
    style: "illustration",
    pixelSize: 4,
    numColors: 8,
    paletteType: "auto",
    extractMethod: "kmeans",
    dithering: "none",
    outline: "soft",
    saturation: 100,
    enhanceContrast: false,
    removeShadow: true,
    seed: 42,
    ...overrides,
  };
}

describe("K-meansパレット抽出", () => {
  it("指定色数を返す（十分な色がある場合）", () => {
    const img = createGradientImage(32, 32);
    for (const n of [4, 8, 16]) {
      expect(extractKMeans(img, n, 42).length).toBe(n);
    }
  });

  it("決定的（同じシード→同じパレット）", () => {
    const img = createGradientImage(32, 32);
    expect(extractKMeans(img, 8, 42)).toEqual(extractKMeans(img, 8, 42));
  });

  it("2色の画像は2つの中心がそれぞれの色に収束する", () => {
    const img = createImage(10, 2);
    for (let i = 0; i < 20; i++) {
      const v = i < 10 ? 10 : 240;
      img.data.set([v, v, v, 255], i * 4);
    }
    const palette = extractKMeans(img, 2, 42);
    const values = palette.map((c) => c.r).sort((a, b) => a - b);
    expect(values[0]).toBe(10);
    expect(values[1]).toBe(240);
  });

  it("全色が0-255の範囲内", () => {
    for (const c of extractKMeans(createGradientImage(24, 24), 8, 42)) {
      for (const v of [c.r, c.g, c.b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe("前処理（手描き風）", () => {
  it("影除去で暗部が持ち上がる", () => {
    const dark = createImage(16, 16);
    for (let i = 0; i < dark.data.length; i += 4) {
      dark.data.set([40, 40, 40, 255], i);
    }
    const out = _internals.preprocess(dark, false, true);
    // ガンマ0.4で暗部（L≈40相当）は大きく明るくなる
    expect(out.data[0]).toBeGreaterThan(100);
  });

  it("removeShadow=falseでは暗部が持ち上がらない（レビュー指摘の回帰防止）", () => {
    const dark = createImage(16, 16);
    for (let i = 0; i < dark.data.length; i += 4) {
      dark.data.set([40, 40, 40, 255], i);
    }
    const out = _internals.preprocess(dark, false, false);
    expect(out.data[0]).toBeLessThan(60);
  });

  it("contrast=trueでも安全に動作し、falseと異なる出力になる", () => {
    const src = createGradientImage(32, 32);
    const off = _internals.preprocess(src, false, true);
    const on = _internals.preprocess(src, true, true);
    expect(imageHash(off)).not.toBe(imageHash(on));
  });

  it("CLAHEが端に暗い縁を作らない（空タイル問題の回帰防止）", () => {
    // 41pxは ceil(41/8)=6 で tx=7 が空タイルになるサイズ
    const size = 41;
    const flat = createImage(size, size);
    for (let i = 0; i < flat.data.length; i += 4) {
      flat.data.set([133, 133, 133, 255], i);
    }
    const out = _internals.preprocess(flat, true, false);
    const at = (x: number, y: number) => out.data[(y * size + x) * 4];
    const center = at(20, 20);
    // 右端・下端・右下角が中央から大きく外れない（旧実装では黒方向に引っ張られた）
    for (const [x, y] of [[size - 1, 20], [20, size - 1], [size - 1, size - 1]] as const) {
      expect(Math.abs(at(x, y) - center)).toBeLessThanOrEqual(8);
    }
  });
});

describe("convertIllustration", () => {
  it("出力は入力と同じサイズ", () => {
    const src = createGradientImage(64, 48);
    const out = convertIllustration(src, baseParams());
    expect(out.width).toBe(64);
    expect(out.height).toBe(48);
  });

  it("ドット絵スタイルを渡すとエラー", () => {
    const src = createGradientImage(8, 8);
    expect(() => convertIllustration(src, baseParams({ style: "pixel-retro" }))).toThrow();
  });

  it("決定的（同じ入力・同じシード→同じ出力）", () => {
    const src = createGradientImage(48, 48);
    const p = baseParams();
    expect(imageHash(convertIllustration(src, p))).toBe(
      imageHash(convertIllustration(src, p))
    );
  });

  it("maxDimension超過時は縮小される", () => {
    const src = createGradientImage(200, 100);
    const out = convertIllustration(src, baseParams({ maxDimension: 100 }));
    expect(out.width).toBe(100);
    expect(out.height).toBe(50);
  });

  it("outline=noneとsoftで出力が変わる（DoGが適用されている）", () => {
    // 最大コントラスト(0/255)の大きめ画像で検証。
    // 前処理ブラー+テクスチャ除去でエッジがなまるため、
    // 弱いエッジだとDoG閾値10を下回りアウトラインが出ないことがある（仕様どおり）
    const size = 128;
    const src = createImage(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const v = x < size / 2 ? 255 : 0;
        src.data.set([v, v, v, 255], (y * size + x) * 4);
      }
    }
    const withOutline = convertIllustration(src, baseParams({ outline: "soft", pixelSize: 2 }));
    const without = convertIllustration(src, baseParams({ outline: "none", pixelSize: 2 }));
    expect(imageHash(withOutline)).not.toBe(imageHash(without));
    // アウトライン=黒(0,0,0)ピクセルが増えている
    const countBlack = (img: typeof withOutline) => {
      let n = 0;
      for (let i = 0; i < img.data.length; i += 4) {
        if (img.data[i] === 0 && img.data[i + 1] === 0 && img.data[i + 2] === 0) n++;
      }
      return n;
    };
    expect(countBlack(withOutline)).toBeGreaterThan(countBlack(without));
  });

  it("removeShadowのON/OFFで出力が変わる（トグルが効いている）", () => {
    const src = createGradientImage(48, 48);
    const on = convertIllustration(src, baseParams({ removeShadow: true }));
    const off = convertIllustration(src, baseParams({ removeShadow: false }));
    expect(imageHash(on)).not.toBe(imageHash(off));
  });

  it("extractMethodの違いが出力に反映される（旧版はK-means固定だった）", () => {
    const src = createGradientImage(48, 48);
    const kmeans = convertIllustration(src, baseParams({ extractMethod: "kmeans" }));
    const median = convertIllustration(src, baseParams({ extractMethod: "mediancut" }));
    expect(imageHash(kmeans)).not.toBe(imageHash(median));
  });

  it("seedを変えてもパレットは変わらない（seedはディザ専用）", () => {
    const src = createGradientImage(48, 48);
    const a = convertIllustration(src, baseParams({ seed: 1, dithering: "none" }));
    const b = convertIllustration(src, baseParams({ seed: 999, dithering: "none" }));
    expect(imageHash(a)).toBe(imageHash(b));
  });

  it("進捗が単調増加で1.0に到達する", () => {
    const src = createGradientImage(32, 32);
    const ratios: number[] = [];
    convertIllustration(src, baseParams(), (p) => ratios.push(p.ratio));
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]).toBeGreaterThanOrEqual(ratios[i - 1]);
    }
    expect(ratios[ratios.length - 1]).toBe(1);
  });
});

describe("ゴールデン: 手描き風パイプラインの回帰検証", () => {
  const cases: [string, Partial<ConversionParams>][] = [
    ["auto-kmeans/8色/アウトラインあり", {}],
    ["auto-kmeans/16色/コントラスト強化", { numColors: 16, enhanceContrast: true }],
    ["固定famicom/FSディザ", { paletteType: "famicom", dithering: "floyd-steinberg" }],
    ["彩度75%/アウトラインなし", { saturation: 75, outline: "none" }],
  ];

  it.each(cases)("%s", (_name, overrides) => {
    const src = createGradientImage(64, 48);
    const out = convertIllustration(src, baseParams(overrides));
    expect(imageHash(out)).toMatchSnapshot();
  });
});
