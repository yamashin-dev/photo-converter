import { describe, it, expect } from "vitest";
import {
  applySaturationInPlace,
  enhanceSaturationInPlace,
  rgbToHsv,
  hsvToRgb,
} from "../../src/engine/filters/saturation";
import { addOutlineInPlace, addSoftOutlineInPlace, detectEdges } from "../../src/engine/filters/outline";
import { resizeNearest, createImage } from "../../src/engine/image";
import { createGradientImage, createTwoToneImage, imageHash } from "../helpers/images";

describe("HSV変換", () => {
  it("RGB→HSV→RGBのラウンドトリップ", () => {
    for (const [r, g, b] of [[255, 0, 0], [0, 255, 0], [0, 0, 255], [128, 64, 200], [50, 50, 50]]) {
      const [h, s, v] = rgbToHsv(r, g, b);
      const [r2, g2, b2] = hsvToRgb(h, s, v);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(1);
    }
  });
});

describe("彩度スケーリング", () => {
  it("100%では変更なし", () => {
    const img = createGradientImage(16, 16);
    const before = imageHash(img);
    applySaturationInPlace(img, 100);
    expect(imageHash(img)).toBe(before);
  });

  it("0%でグレースケール化", () => {
    const img = createImage(1, 1);
    img.data.set([200, 50, 100, 255]);
    applySaturationInPlace(img, 0);
    expect(img.data[0]).toBe(img.data[1]);
    expect(img.data[1]).toBe(img.data[2]);
  });

  it("200%で彩度が上がる（チャンネル差が広がる）", () => {
    const img = createImage(1, 1);
    img.data.set([150, 100, 50, 255]);
    const diffBefore = 150 - 50;
    applySaturationInPlace(img, 200);
    expect(img.data[0] - img.data[2]).toBeGreaterThan(diffBefore);
  });
});

describe("彩度強調（ビビッド）", () => {
  it("グレー（彩度0.05以下）は変更しない", () => {
    const img = createImage(1, 1);
    img.data.set([128, 128, 128, 255]);
    enhanceSaturationInPlace(img);
    expect([...img.data.slice(0, 3)]).toEqual([128, 128, 128]);
  });

  it("有彩色は彩度が上がる", () => {
    const img = createImage(1, 1);
    img.data.set([150, 100, 80, 255]);
    const [, sBefore] = rgbToHsv(150, 100, 80);
    enhanceSaturationInPlace(img);
    const [, sAfter] = rgbToHsv(img.data[0], img.data[1], img.data[2]);
    expect(sAfter).toBeGreaterThan(sBefore);
  });
});

describe("アウトライン", () => {
  it("detectEdges: 2色境界がエッジとして検出される", () => {
    const img = createTwoToneImage(16, 16, [255, 255, 255], [0, 0, 0]);
    const edges = detectEdges(img, "sobel", 30);
    let count = 0;
    for (const e of edges) count += e;
    expect(count).toBeGreaterThan(0);
  });

  it("addOutline: 境界に黒線が引かれる", () => {
    const img = createTwoToneImage(16, 16, [255, 255, 255], [200, 200, 200]);
    addOutlineInPlace(img, 4);
    let hasBlack = false;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] === 0 && img.data[i + 1] === 0 && img.data[i + 2] === 0) {
        hasBlack = true;
        break;
      }
    }
    expect(hasBlack).toBe(true);
  });

  it("addSoftOutline: 境界が暗いグレー(50,50,50)になる", () => {
    const img = createTwoToneImage(16, 16, [255, 255, 255], [0, 0, 0]);
    addSoftOutlineInPlace(img);
    let hasGray = false;
    for (let i = 0; i < img.data.length; i += 4) {
      if (img.data[i] === 50 && img.data[i + 1] === 50 && img.data[i + 2] === 50) {
        hasGray = true;
        break;
      }
    }
    expect(hasGray).toBe(true);
  });
});

describe("resizeNearest", () => {
  it("整数倍拡大は完全なブロック複製", () => {
    const img = createImage(2, 1);
    img.data.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const out = resizeNearest(img, 4, 2);
    // 左半分は赤、右半分は青
    for (const [x, y, expected] of [
      [0, 0, [255, 0, 0]],
      [1, 0, [255, 0, 0]],
      [2, 0, [0, 0, 255]],
      [3, 1, [0, 0, 255]],
    ] as const) {
      const i = (y * 4 + x) * 4;
      expect([...out.data.slice(i, i + 3)]).toEqual([...expected]);
    }
  });

  it("縮小→拡大でサイズが復元される", () => {
    const img = createGradientImage(100, 60);
    const small = resizeNearest(img, 25, 15);
    const restored = resizeNearest(small, 100, 60);
    expect(restored.width).toBe(100);
    expect(restored.height).toBe(60);
  });
});
