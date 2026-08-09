import type { ImageBuffer } from "../image";
import { cloneImage } from "../image";

/**
 * 畳み込み系フィルタ（OpenCV互換パラメータ）。
 * 境界は BORDER_REFLECT_101（gfedcb|abcdefgh|gfedcba、OpenCVのデフォルト）。
 */

/** 境界反射（REFLECT_101）: gfedcb|abcdefgh|gfedcba */
export function reflect101(i: number, size: number): number {
  if (size === 1) return 0;
  while (i < 0 || i >= size) {
    if (i < 0) i = -i;
    if (i >= size) i = 2 * (size - 1) - i;
  }
  return i;
}

/**
 * OpenCVのgetGaussianKernelが sigma<=0 かつ ksize<=7 のときに使う固定二項カーネル
 * （small_gaussian_tab）。σ式で近似すると値がわずかにずれるため、実表を持つ。
 */
const SMALL_GAUSSIAN_TAB: Record<number, readonly number[]> = {
  1: [1],
  3: [0.25, 0.5, 0.25],
  5: [0.0625, 0.25, 0.375, 0.25, 0.0625],
  7: [0.03125, 0.109375, 0.21875, 0.28125, 0.21875, 0.109375, 0.03125],
};

/**
 * ガウシアンカーネル生成（OpenCVのgetGaussianKernel互換）。
 * - sigma<=0 かつ ksize<=7（奇数）: 固定二項カーネルを使う
 * - それ以外: sigma<=0 なら 0.3*((ksize-1)*0.5 - 1) + 0.8 で自動計算
 */
export function gaussianKernel(ksize: number, sigma: number): Float64Array {
  if (sigma <= 0) {
    const fixed = SMALL_GAUSSIAN_TAB[ksize];
    if (fixed) return Float64Array.from(fixed);
  }
  const s = sigma > 0 ? sigma : 0.3 * ((ksize - 1) * 0.5 - 1) + 0.8;
  const kernel = new Float64Array(ksize);
  const center = (ksize - 1) / 2;
  let sum = 0;
  for (let i = 0; i < ksize; i++) {
    const d = i - center;
    kernel[i] = Math.exp(-(d * d) / (2 * s * s));
    sum += kernel[i];
  }
  for (let i = 0; i < ksize; i++) kernel[i] /= sum;
  return kernel;
}

/** 分離可能ガウシアンブラー（RGB、アルファは保持） */
export function gaussianBlurImage(src: ImageBuffer, ksize: number, sigma: number): ImageBuffer {
  const kernel = gaussianKernel(ksize, sigma);
  const { width, height, data } = src;
  const radius = (ksize - 1) / 2;

  // 水平パス
  const temp = new Float64Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < ksize; k++) {
        const sx = reflect101(x + k - radius, width);
        const si = (y * width + sx) * 4;
        const w = kernel[k];
        r += data[si] * w;
        g += data[si + 1] * w;
        b += data[si + 2] * w;
      }
      const ti = (y * width + x) * 3;
      temp[ti] = r;
      temp[ti + 1] = g;
      temp[ti + 2] = b;
    }
  }

  // 垂直パス
  const dst = cloneImage(src);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < ksize; k++) {
        const sy = reflect101(y + k - radius, height);
        const ti = (sy * width + x) * 3;
        const w = kernel[k];
        r += temp[ti] * w;
        g += temp[ti + 1] * w;
        b += temp[ti + 2] * w;
      }
      const di = (y * width + x) * 4;
      dst.data[di] = Math.round(r);
      dst.data[di + 1] = Math.round(g);
      dst.data[di + 2] = Math.round(b);
    }
  }
  return dst;
}

/** 分離可能ガウシアンブラー（単一チャンネルFloat32、DoG用） */
export function gaussianBlurChannel(
  src: Float32Array,
  width: number,
  height: number,
  ksize: number,
  sigma: number
): Float32Array {
  const kernel = gaussianKernel(ksize, sigma);
  const radius = (ksize - 1) / 2;

  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < ksize; k++) {
        sum += src[y * width + reflect101(x + k - radius, width)] * kernel[k];
      }
      temp[y * width + x] = sum;
    }
  }

  const dst = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let k = 0; k < ksize; k++) {
        sum += temp[reflect101(y + k - radius, height) * width + x] * kernel[k];
      }
      dst[y * width + x] = sum;
    }
  }
  return dst;
}

/** メディアンフィルタ（RGB各チャンネル独立、境界はBORDER_REPLICATE） */
export function medianBlurImage(src: ImageBuffer, ksize: number): ImageBuffer {
  const { width, height, data } = src;
  const dst = cloneImage(src);
  const radius = (ksize - 1) / 2;
  const windowSize = ksize * ksize;
  const mid = Math.floor(windowSize / 2);
  const rWin = new Uint8Array(windowSize);
  const gWin = new Uint8Array(windowSize);
  const bWin = new Uint8Array(windowSize);

  const clampIdx = (v: number, size: number) => (v < 0 ? 0 : v >= size ? size - 1 : v);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const sy = clampIdx(y + dy, height);
        for (let dx = -radius; dx <= radius; dx++) {
          const sx = clampIdx(x + dx, width);
          const si = (sy * width + sx) * 4;
          rWin[n] = data[si];
          gWin[n] = data[si + 1];
          bWin[n] = data[si + 2];
          n++;
        }
      }
      const rs = rWin.slice().sort();
      const gs = gWin.slice().sort();
      const bs = bWin.slice().sort();
      const di = (y * width + x) * 4;
      dst.data[di] = rs[mid];
      dst.data[di + 1] = gs[mid];
      dst.data[di + 2] = bs[mid];
    }
  }
  return dst;
}

/**
 * Bilateralフィルタ（OpenCVのbilateralFilter 8UC3互換）。
 * 色重みは3チャンネルのL1距離、空間重みは円形近傍（半径d/2）。
 * エッジを保持しながら平滑化する（手描き風の要）。
 */
export function bilateralFilterImage(
  src: ImageBuffer,
  d: number,
  sigmaColor: number,
  sigmaSpace: number
): ImageBuffer {
  const { width, height, data } = src;
  const dst = cloneImage(src);
  const radius = Math.floor(d / 2);

  // 色重みテーブル（L1距離 0〜765）
  const colorCoeff = -0.5 / (sigmaColor * sigmaColor);
  const colorWeight = new Float64Array(256 * 3);
  for (let i = 0; i < colorWeight.length; i++) {
    colorWeight[i] = Math.exp(i * i * colorCoeff);
  }

  // 空間重みとオフセット（円形近傍）
  const spaceCoeff = -0.5 / (sigmaSpace * sigmaSpace);
  const offsets: number[] = [];
  const spaceWeights: number[] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const rr = Math.sqrt(dx * dx + dy * dy);
      if (rr > radius) continue;
      offsets.push(dy, dx);
      spaceWeights.push(Math.exp(rr * rr * spaceCoeff));
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ci = (y * width + x) * 4;
      const cr = data[ci];
      const cg = data[ci + 1];
      const cb = data[ci + 2];

      let sumR = 0, sumG = 0, sumB = 0, sumW = 0;
      for (let k = 0; k < spaceWeights.length; k++) {
        const sy = reflect101(y + offsets[k * 2], height);
        const sx = reflect101(x + offsets[k * 2 + 1], width);
        const si = (sy * width + sx) * 4;
        const nr = data[si];
        const ng = data[si + 1];
        const nb = data[si + 2];
        const colorDist = Math.abs(nr - cr) + Math.abs(ng - cg) + Math.abs(nb - cb);
        const w = spaceWeights[k] * colorWeight[colorDist];
        sumR += nr * w;
        sumG += ng * w;
        sumB += nb * w;
        sumW += w;
      }
      const di = (y * width + x) * 4;
      dst.data[di] = Math.round(sumR / sumW);
      dst.data[di + 1] = Math.round(sumG / sumW);
      dst.data[di + 2] = Math.round(sumB / sumW);
    }
  }
  return dst;
}
