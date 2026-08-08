import type { Palette } from "../types";
import type { ImageBuffer } from "../image";
import { findClosestIndex } from "../color";

/**
 * 誤差拡散系ディザリング（旧convert.php:996-1161 から移植）。
 */

/** 誤差を保持する作業バッファ（クランプせず小数のまま伝搬させる） */
function toFloatPixels(image: ImageBuffer): Float32Array {
  const { data } = image;
  const out = new Float32Array((data.length / 4) * 3);
  for (let i = 0, p = 0; p < data.length; i += 3, p += 4) {
    out[i] = data[p];
    out[i + 1] = data[p + 1];
    out[i + 2] = data[p + 2];
  }
  return out;
}

function clampChannel(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Floyd-Steinberg誤差拡散（サーペンタインスキャン）。
 * 偶数行は左→右、奇数行は右→左に走査し、拡散パターンも左右反転する。
 */
export function applyFloydSteinbergInPlace(image: ImageBuffer, palette: Palette): void {
  const { width, height, data } = image;
  const pixels = toFloatPixels(image);

  const diffuse = (x: number, y: number, er: number, eg: number, eb: number, w: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 3;
    pixels[i] = clampChannel(pixels[i] + er * w);
    pixels[i + 1] = clampChannel(pixels[i + 1] + eg * w);
    pixels[i + 2] = clampChannel(pixels[i + 2] + eb * w);
  };

  for (let y = 0; y < height; y++) {
    const isEvenRow = y % 2 === 0;
    const xStart = isEvenRow ? 0 : width - 1;
    const xEnd = isEvenRow ? width : -1;
    const xStep = isEvenRow ? 1 : -1;
    const forward = xStep; // 走査方向

    for (let x = xStart; x !== xEnd; x += xStep) {
      const i = (y * width + x) * 3;
      const oldR = pixels[i];
      const oldG = pixels[i + 1];
      const oldB = pixels[i + 2];

      const c = palette[findClosestIndex({ r: oldR, g: oldG, b: oldB }, palette)];
      const outIdx = (y * width + x) * 4;
      data[outIdx] = c.r;
      data[outIdx + 1] = c.g;
      data[outIdx + 2] = c.b;

      const er = oldR - c.r;
      const eg = oldG - c.g;
      const eb = oldB - c.b;

      // 拡散パターン（走査方向に応じて左右反転）
      //        X    7/16
      // 3/16  5/16  1/16
      diffuse(x + forward, y, er, eg, eb, 7 / 16);
      diffuse(x - forward, y + 1, er, eg, eb, 3 / 16);
      diffuse(x, y + 1, er, eg, eb, 5 / 16);
      diffuse(x + forward, y + 1, er, eg, eb, 1 / 16);
    }
  }
}

/**
 * Riemersma風の広範囲誤差拡散（旧convert.php:1090-1161）。
 *
 * 注: 旧実装はHilbert曲線ではなく「16近傍への距離減衰拡散」であり、
 * 拡散重みの合計が1を超える（誤差が増幅される）挙動も含めて忠実に移植している。
 * 品質改善はゴールデンテスト整備後に別途行う。
 */
const RIEMERSMA_PATTERN: readonly [number, number, number][] = [
  [1, 0, 0.4375],
  [-1, 0, 0.4375],
  [0, 1, 0.4375],
  [0, -1, 0.4375],
  [1, 1, 0.1875],
  [-1, 1, 0.1875],
  [1, -1, 0.1875],
  [-1, -1, 0.1875],
  [2, 0, 0.0625],
  [-2, 0, 0.0625],
  [0, 2, 0.0625],
  [0, -2, 0.0625],
  [1, 2, 0.03125],
  [-1, 2, 0.03125],
  [2, 1, 0.03125],
  [-2, 1, 0.03125],
];

export function applyRiemersmaInPlace(image: ImageBuffer, palette: Palette): void {
  const { width, height, data } = image;
  const pixels = toFloatPixels(image);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const oldR = pixels[i];
      const oldG = pixels[i + 1];
      const oldB = pixels[i + 2];

      const c = palette[findClosestIndex({ r: oldR, g: oldG, b: oldB }, palette)];
      const outIdx = (y * width + x) * 4;
      data[outIdx] = c.r;
      data[outIdx + 1] = c.g;
      data[outIdx + 2] = c.b;

      const er = oldR - c.r;
      const eg = oldG - c.g;
      const eb = oldB - c.b;

      for (const [dx, dy, w] of RIEMERSMA_PATTERN) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = (ny * width + nx) * 3;
        pixels[ni] = clampChannel(pixels[ni] + er * w);
        pixels[ni + 1] = clampChannel(pixels[ni + 1] + eg * w);
        pixels[ni + 2] = clampChannel(pixels[ni + 2] + eb * w);
      }
    }
  }
}
