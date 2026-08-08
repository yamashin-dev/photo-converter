import type { ImageBuffer } from "../../src/engine/image";
import { createImage } from "../../src/engine/image";

/** 決定的な合成テスト画像: 対角グラデーション + 色相変化 */
export function createGradientImage(width: number, height: number): ImageBuffer {
  const img = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      img.data[i] = Math.floor((x / (width - 1 || 1)) * 255);
      img.data[i + 1] = Math.floor((y / (height - 1 || 1)) * 255);
      img.data[i + 2] = Math.floor(((x + y) / (width + height - 2 || 1)) * 255);
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/** 左右2色に分かれたエッジ画像（アウトライン検証用） */
export function createTwoToneImage(
  width: number,
  height: number,
  left: [number, number, number],
  right: [number, number, number]
): ImageBuffer {
  const img = createImage(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const [r, g, b] = x < width / 2 ? left : right;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
      img.data[i + 3] = 255;
    }
  }
  return img;
}

/** 画像内の全ピクセルが与えられたパレット色のみで構成されているか */
export function usesOnlyPaletteColors(
  img: ImageBuffer,
  palette: readonly { r: number; g: number; b: number }[]
): boolean {
  const allowed = new Set(palette.map((c) => (c.r << 16) | (c.g << 8) | c.b));
  for (let i = 0; i < img.data.length; i += 4) {
    const key = (img.data[i] << 16) | (img.data[i + 1] << 8) | img.data[i + 2];
    if (!allowed.has(key)) return false;
  }
  return true;
}

/** 出力の回帰検証用ハッシュ（FNV-1a 32bit） */
export function imageHash(img: ImageBuffer): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < img.data.length; i++) {
    hash ^= img.data[i];
    hash = Math.imul(hash, 0x01000193);
  }
  return `${img.width}x${img.height}:${(hash >>> 0).toString(16)}`;
}
