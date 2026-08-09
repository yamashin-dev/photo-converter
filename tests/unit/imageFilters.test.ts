import { describe, it, expect } from "vitest";
import {
  gaussianKernel,
  gaussianBlurImage,
  gaussianBlurChannel,
  medianBlurImage,
  bilateralFilterImage,
} from "../../src/engine/filters/convolution";
import { claheChannel, equalizeHistChannel } from "../../src/engine/filters/clahe";
import { rgbToLab, labToRgb, rgbToYuv, yuvToRgb } from "../../src/engine/filters/colorspace";
import { createImage } from "../../src/engine/image";
import { createGradientImage, imageHash } from "../helpers/images";

/** 全ピクセルを同一色にした画像 */
function createFlatImage(width: number, height: number, r: number, g: number, b: number) {
  const img = createImage(width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  }
  return img;
}

describe("色空間変換", () => {
  const samples: [number, number, number][] = [
    [0, 0, 0],
    [255, 255, 255],
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [128, 64, 200],
    [50, 100, 150],
  ];

  it("RGB→LAB→RGBのラウンドトリップ（誤差±3以内）", () => {
    for (const [r, g, b] of samples) {
      const [l, a, bb] = rgbToLab(r, g, b);
      const [r2, g2, b2] = labToRgb(l, a, bb);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(3);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(3);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(3);
    }
  });

  it("RGB→YUV→RGBのラウンドトリップ（中間的な色で誤差±3以内）", () => {
    // 純色(255,0,0)等はU/Vが8Uレンジ外に出てクリップされ復元不能
    // （OpenCVの8U実装も同じ挙動）。中間的な色で検証する
    const moderate: [number, number, number][] = [
      [0, 0, 0],
      [255, 255, 255],
      [128, 64, 200],
      [50, 100, 150],
      [180, 120, 90],
    ];
    for (const [r, g, b] of moderate) {
      const [y, u, v] = rgbToYuv(r, g, b);
      const [r2, g2, b2] = yuvToRgb(y, u, v);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(3);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(3);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(3);
    }
  });

  it("白のL(8Uスケール)は255、黒は0", () => {
    expect(rgbToLab(255, 255, 255)[0]).toBe(255);
    expect(rgbToLab(0, 0, 0)[0]).toBe(0);
  });
});

describe("ガウシアンブラー", () => {
  it("カーネルの合計は1", () => {
    for (const [k, s] of [[9, 0], [5, 1.1], [7, 2.0]] as const) {
      const kernel = gaussianKernel(k, s);
      const sum = kernel.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("sigma<=0かつksize<=7はOpenCVの固定二項カーネルを使う", () => {
    // OpenCVのsmall_gaussian_tabと一致すること（レビュー指摘の回帰防止）
    expect([...gaussianKernel(3, 0)]).toEqual([0.25, 0.5, 0.25]);
    expect([...gaussianKernel(5, 0)]).toEqual([0.0625, 0.25, 0.375, 0.25, 0.0625]);
    expect([...gaussianKernel(7, 0)]).toEqual([
      0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125,
    ]);
    // ksize>7 または sigma>0 はσ式（固定表を使わない）
    expect(gaussianKernel(9, 0)[4]).not.toBe(0.375);
    expect([...gaussianKernel(5, 1.0)]).not.toEqual([0.0625, 0.25, 0.375, 0.25, 0.0625]);
  });

  it("単色画像は変化しない", () => {
    const img = createFlatImage(16, 16, 100, 150, 200);
    const out = gaussianBlurImage(img, 9, 0);
    expect(imageHash(out)).toBe(imageHash(img));
  });

  it("エッジがなまる（隣接差が縮小する）", () => {
    const img = createImage(8, 1);
    for (let x = 0; x < 8; x++) {
      const v = x < 4 ? 0 : 255;
      img.data.set([v, v, v, 255], x * 4);
    }
    const out = gaussianBlurImage(img, 5, 0);
    const diffAt3 = Math.abs(out.data[4 * 4] - out.data[3 * 4]);
    expect(diffAt3).toBeLessThan(255);
    expect(diffAt3).toBeGreaterThan(0);
  });

  it("チャンネル版も単色を保存する", () => {
    const ch = new Float32Array(64).fill(42);
    const out = gaussianBlurChannel(ch, 8, 8, 5, 1.0);
    for (const v of out) expect(v).toBeCloseTo(42, 4);
  });
});

describe("メディアンフィルタ", () => {
  it("ソルトノイズを除去する", () => {
    const img = createFlatImage(9, 9, 100, 100, 100);
    // 中央に白ノイズ1点
    img.data.set([255, 255, 255, 255], (4 * 9 + 4) * 4);
    const out = medianBlurImage(img, 3);
    const center = (4 * 9 + 4) * 4;
    expect(out.data[center]).toBe(100);
  });
});

describe("Bilateralフィルタ", () => {
  it("単色画像は変化しない", () => {
    const img = createFlatImage(16, 16, 80, 120, 160);
    const out = bilateralFilterImage(img, 9, 75, 75);
    expect(imageHash(out)).toBe(imageHash(img));
  });

  it("強いエッジは保持し、弱いノイズは平滑化する", () => {
    // 左右で0/255の強エッジ
    const img = createImage(16, 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 16; x++) {
        const v = x < 8 ? 0 : 255;
        img.data.set([v, v, v, 255], (y * 16 + x) * 4);
      }
    }
    const out = bilateralFilterImage(img, 9, 75, 75);
    // エッジ両側の値がほぼ保たれている（ガウシアンなら大きくなまる）
    const leftIdx = (1 * 16 + 6) * 4;
    const rightIdx = (1 * 16 + 9) * 4;
    expect(out.data[leftIdx]).toBeLessThan(30);
    expect(out.data[rightIdx]).toBeGreaterThan(225);
  });
});

describe("ヒストグラム均等化", () => {
  it("equalizeHist: 狭いレンジが広がる", () => {
    const n = 1024;
    const ch = new Uint8Array(n);
    for (let i = 0; i < n; i++) ch[i] = 100 + (i % 20); // 100-119の狭いレンジ
    equalizeHistChannel(ch, n);
    let min = 255;
    let max = 0;
    for (const v of ch) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(max - min).toBeGreaterThan(200);
  });

  it("equalizeHist: 全ピクセル同一値でも安全", () => {
    const ch = new Uint8Array(64).fill(42);
    expect(() => equalizeHistChannel(ch, 64)).not.toThrow();
    expect(ch[0]).toBe(42);
  });

  it("CLAHE: 低コントラスト画像のレンジが広がり、決定的", () => {
    const w = 64;
    const h = 64;
    const make = () => {
      const ch = new Uint8Array(w * h);
      for (let i = 0; i < ch.length; i++) ch[i] = 110 + ((i * 7) % 30);
      return ch;
    };
    const a = make();
    const b = make();
    claheChannel(a, w, h, 4.0, 8, 8);
    claheChannel(b, w, h, 4.0, 8, 8);
    expect(a).toEqual(b);

    let min = 255;
    let max = 0;
    for (const v of a) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    expect(max - min).toBeGreaterThan(60);
  });
});

describe("ゴールデン: フィルタの回帰検証", () => {
  it("gaussian 9x9", () => {
    const out = gaussianBlurImage(createGradientImage(32, 32), 9, 0);
    expect(imageHash(out)).toMatchSnapshot();
  });
  it("bilateral 9/75/75", () => {
    const out = bilateralFilterImage(createGradientImage(32, 32), 9, 75, 75);
    expect(imageHash(out)).toMatchSnapshot();
  });
  it("median 5", () => {
    const out = medianBlurImage(createGradientImage(32, 32), 5);
    expect(imageHash(out)).toMatchSnapshot();
  });
});
