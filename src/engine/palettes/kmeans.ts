import type { RGB, Palette } from "../types";
import type { ImageBuffer } from "../image";
import { createRng, type Rng } from "../random";

/**
 * K-meansパレット抽出（旧convert-photo-drawingのsklearn.KMeans相当）。
 *
 * sklearnと同じ設定（k-means++初期化、n_init=10、収束判定）を踏襲するが、
 * 乱数生成器が異なるためsklearnの出力とはビット一致しない（意図的差分）。
 * 本エンジン内では同じシード → 同じパレットが保証される。
 */

const N_INIT = 10;
const MAX_ITER = 100;
const TOL = 1e-4;

interface KMeansResult {
  centers: Float64Array; // k * 3
  inertia: number;
}

/** k-means++ 初期化 */
function initCenters(pixels: Float64Array, n: number, k: number, rng: Rng): Float64Array {
  const centers = new Float64Array(k * 3);

  // 最初の中心は一様ランダム
  const first = Math.floor(rng() * n);
  centers[0] = pixels[first * 3];
  centers[1] = pixels[first * 3 + 1];
  centers[2] = pixels[first * 3 + 2];

  const minDistSq = new Float64Array(n).fill(Infinity);

  for (let c = 1; c < k; c++) {
    // 直前に追加した中心との距離で最小距離を更新
    const pr = centers[(c - 1) * 3];
    const pg = centers[(c - 1) * 3 + 1];
    const pb = centers[(c - 1) * 3 + 2];
    let total = 0;
    for (let i = 0; i < n; i++) {
      const dr = pixels[i * 3] - pr;
      const dg = pixels[i * 3 + 1] - pg;
      const db = pixels[i * 3 + 2] - pb;
      const d = dr * dr + dg * dg + db * db;
      if (d < minDistSq[i]) minDistSq[i] = d;
      total += minDistSq[i];
    }

    // 距離の2乗に比例した確率で次の中心を選ぶ
    if (total === 0) {
      const idx = Math.floor(rng() * n);
      centers[c * 3] = pixels[idx * 3];
      centers[c * 3 + 1] = pixels[idx * 3 + 1];
      centers[c * 3 + 2] = pixels[idx * 3 + 2];
      continue;
    }
    let target = rng() * total;
    let idx = 0;
    for (let i = 0; i < n; i++) {
      target -= minDistSq[i];
      if (target <= 0) {
        idx = i;
        break;
      }
    }
    centers[c * 3] = pixels[idx * 3];
    centers[c * 3 + 1] = pixels[idx * 3 + 1];
    centers[c * 3 + 2] = pixels[idx * 3 + 2];
  }
  return centers;
}

/** Lloyd法の1試行 */
function runSingle(pixels: Float64Array, n: number, k: number, rng: Rng): KMeansResult {
  let centers = initCenters(pixels, n, k, rng);
  const assignments = new Int32Array(n);
  const sums = new Float64Array(k * 3);
  const counts = new Uint32Array(k);

  let inertia = Infinity;

  for (let iter = 0; iter < MAX_ITER; iter++) {
    // 割り当て
    let newInertia = 0;
    for (let i = 0; i < n; i++) {
      const r = pixels[i * 3];
      const g = pixels[i * 3 + 1];
      const b = pixels[i * 3 + 2];
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dr = r - centers[c * 3];
        const dg = g - centers[c * 3 + 1];
        const db = b - centers[c * 3 + 2];
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      assignments[i] = best;
      newInertia += bestDist;
    }

    // 中心の更新
    sums.fill(0);
    counts.fill(0);
    for (let i = 0; i < n; i++) {
      const c = assignments[i];
      sums[c * 3] += pixels[i * 3];
      sums[c * 3 + 1] += pixels[i * 3 + 1];
      sums[c * 3 + 2] += pixels[i * 3 + 2];
      counts[c]++;
    }
    const newCenters = new Float64Array(k * 3);
    for (let c = 0; c < k; c++) {
      if (counts[c] === 0) {
        // 空クラスタ: ランダムなピクセルを再割り当て
        const idx = Math.floor(rng() * n);
        newCenters[c * 3] = pixels[idx * 3];
        newCenters[c * 3 + 1] = pixels[idx * 3 + 1];
        newCenters[c * 3 + 2] = pixels[idx * 3 + 2];
      } else {
        newCenters[c * 3] = sums[c * 3] / counts[c];
        newCenters[c * 3 + 1] = sums[c * 3 + 1] / counts[c];
        newCenters[c * 3 + 2] = sums[c * 3 + 2] / counts[c];
      }
    }

    // 収束判定（中心の移動量）
    let shift = 0;
    for (let i = 0; i < k * 3; i++) {
      const d = newCenters[i] - centers[i];
      shift += d * d;
    }
    centers = newCenters;
    inertia = newInertia;
    if (shift < TOL) break;
  }

  return { centers, inertia };
}

/** 抽出対象ピクセルの上限（速度確保のためのサンプリング閾値） */
const KMEANS_SAMPLE_LIMIT = 20000;

/**
 * K-meansで画像からnumColors色のパレットを抽出。
 * seedを固定すれば決定的。
 */
export function extractKMeans(image: ImageBuffer, numColors: number, seed: number): Palette {
  const { width, height, data } = image;
  const total = width * height;

  // 大きい画像は等間隔サンプリング（縮小後画像が対象なので通常は全ピクセル）
  const step = Math.max(1, Math.floor(total / KMEANS_SAMPLE_LIMIT));
  const n = Math.ceil(total / step);
  const pixels = new Float64Array(n * 3);
  for (let i = 0, p = 0; i < total; i += step, p++) {
    pixels[p * 3] = data[i * 4];
    pixels[p * 3 + 1] = data[i * 4 + 1];
    pixels[p * 3 + 2] = data[i * 4 + 2];
  }

  const k = Math.min(numColors, n);
  const rng = createRng(seed);

  let best: KMeansResult | null = null;
  for (let trial = 0; trial < N_INIT; trial++) {
    const result = runSingle(pixels, n, k, rng);
    if (best === null || result.inertia < best.inertia) best = result;
  }

  const palette: RGB[] = [];
  for (let c = 0; c < k; c++) {
    palette.push({
      r: Math.floor(best!.centers[c * 3]),
      g: Math.floor(best!.centers[c * 3 + 1]),
      b: Math.floor(best!.centers[c * 3 + 2]),
    });
  }
  // 画像のユニーク色数がnumColors未満の場合はそのまま（水増ししない）
  return palette;
}
