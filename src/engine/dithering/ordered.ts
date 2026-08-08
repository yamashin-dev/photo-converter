import type { Palette } from "../types";
import type { ImageBuffer } from "../image";
import { findClosestIndex } from "../color";
import { luma } from "../image";
import type { Rng } from "../random";
import { randInt } from "../random";

/**
 * Ordered (Bayer) ディザリング 2x2 / 4x4 / 8x8。
 *
 * 旧実装（convert.php:1164-1487）は3サイズがほぼ同一のコピペ実装だったため、
 * Bayer行列と強度パラメータのみ差し替える共通実装に統合した。
 * 適応的閾値（明度×コントラスト×パレットサイズ）とRGBチャンネル別重みは旧実装と同一。
 * ランダムオフセットはシード付き乱数に置き換え、同じシードなら同じ出力になる。
 */

interface OrderedConfig {
  matrix: readonly (readonly number[])[];
  /** 行列サイズ（2/4/8） */
  size: number;
  /** 正規化除数（4/16/64） */
  divisor: number;
  /** 閾値の基本強度（96/64/48） */
  strength: number;
}

const CONFIGS: Record<"2x2" | "4x4" | "8x8", OrderedConfig> = {
  "2x2": {
    matrix: [
      [0, 2],
      [3, 1],
    ],
    size: 2,
    divisor: 4,
    strength: 96,
  },
  "4x4": {
    matrix: [
      [0, 8, 2, 10],
      [12, 4, 14, 6],
      [3, 11, 1, 9],
      [15, 7, 13, 5],
    ],
    size: 4,
    divisor: 16,
    strength: 64,
  },
  "8x8": {
    matrix: [
      [0, 32, 8, 40, 2, 34, 10, 42],
      [48, 16, 56, 24, 50, 18, 58, 26],
      [12, 44, 4, 36, 14, 46, 6, 38],
      [60, 28, 52, 20, 62, 30, 54, 22],
      [3, 35, 11, 43, 1, 33, 9, 41],
      [51, 19, 59, 27, 49, 17, 57, 25],
      [15, 47, 7, 39, 13, 45, 5, 37],
      [63, 31, 55, 23, 61, 29, 53, 21],
    ],
    size: 8,
    divisor: 64,
    strength: 48,
  },
};

// RGBチャンネル別の重み（人間の視覚特性: 緑に敏感なので控えめ、青に鈍感なので強め）
const WEIGHT_R = 1.0;
const WEIGHT_G = 0.7;
const WEIGHT_B = 1.2;

/** 画像の明度・コントラスト・パレットサイズから適応的閾値乗数を計算 */
function computeThresholdMultiplier(image: ImageBuffer, paletteSize: number): number {
  const { width, height, data } = image;
  const sampleRate = Math.max(1, Math.floor((width * height) / 10000));

  let sum = 0;
  let min = 255;
  let max = 0;
  let sampled = 0;
  for (let y = 0; y < height; y += sampleRate) {
    for (let x = 0; x < width; x += sampleRate) {
      const i = (y * width + x) * 4;
      const brightness = luma(data[i], data[i + 1], data[i + 2]);
      sum += brightness;
      if (brightness < min) min = brightness;
      if (brightness > max) max = brightness;
      sampled++;
    }
  }
  const avgBrightness = sum / sampled;
  const contrast = max - min;

  const brightnessMultiplier = avgBrightness < 85 ? 1.5 : avgBrightness > 170 ? 0.7 : 1.0;
  const contrastMultiplier = contrast < 50 ? 1.4 : contrast > 150 ? 0.8 : 1.0;
  const paletteMultiplier = paletteSize <= 8 ? 1.5 : paletteSize <= 16 ? 1.0 : 0.7;

  return brightnessMultiplier * contrastMultiplier * paletteMultiplier;
}

export function applyOrderedInPlace(
  image: ImageBuffer,
  palette: Palette,
  variant: "2x2" | "4x4" | "8x8",
  rng: Rng
): void {
  const { matrix, size, divisor, strength } = CONFIGS[variant];
  const { width, height, data } = image;

  const thresholdMultiplier = computeThresholdMultiplier(image, palette.length);

  // パターンを見えにくくするオフセット（シード付き乱数で決定的）
  const offsetX = randInt(rng, size - 1);
  const offsetY = randInt(rng, size - 1);

  for (let y = 0; y < height; y++) {
    const my = (y + offsetY) % size;
    for (let x = 0; x < width; x++) {
      const mx = (x + offsetX) % size;
      const baseThreshold =
        (matrix[my][mx] / divisor - 0.5) * strength * thresholdMultiplier;

      const i = (y * width + x) * 4;
      const r = Math.max(0, Math.min(255, data[i] + baseThreshold * WEIGHT_R));
      const g = Math.max(0, Math.min(255, data[i + 1] + baseThreshold * WEIGHT_G));
      const b = Math.max(0, Math.min(255, data[i + 2] + baseThreshold * WEIGHT_B));

      const c = palette[findClosestIndex({ r, g, b }, palette)];
      data[i] = c.r;
      data[i + 1] = c.g;
      data[i + 2] = c.b;
    }
  }
}
