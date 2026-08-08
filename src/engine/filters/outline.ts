import type { ImageBuffer } from "../image";
import { luma } from "../image";

/**
 * アウトライン描画（旧convert.php:600-862 から移植）。
 * 画像特性（エッジ密度・コントラスト）を分析して
 * Sobel / Prewitt / Laplacian を自動選択する。
 */

type EdgeAlgorithm = "sobel" | "prewitt" | "laplacian";

interface ImageCharacteristics {
  edgeDensity: number; // 0.0-1.0
  avgContrast: number; // 0-255
}

/** グレースケール輝度の配列を作る（エッジ検出の共通前処理） */
function toGrayscale(image: ImageBuffer): Float32Array {
  const { width, height, data } = image;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
    gray[i] = Math.floor(luma(data[p], data[p + 1], data[p + 2]));
  }
  return gray;
}

/** 画像特性の分析（サンプリングでエッジ密度と平均コントラストを推定） */
export function analyzeImageCharacteristics(image: ImageBuffer): ImageCharacteristics {
  const { width, height } = image;
  const gray = toGrayscale(image);
  const sampleRate = Math.max(1, Math.floor(Math.sqrt((width * height) / 1000)));

  let edgeCount = 0;
  let contrastSum = 0;

  for (let y = 1; y < height - 1; y += sampleRate) {
    for (let x = 1; x < width - 1; x += sampleRate) {
      const center = gray[y * width + x];
      let maxDiff = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const diff = Math.abs(center - gray[(y + dy) * width + (x + dx)]);
          if (diff > maxDiff) maxDiff = diff;
        }
      }
      contrastSum += maxDiff;
      if (maxDiff > 20) edgeCount++;
    }
  }

  // 分母は旧実装（convert.php:648）と同じ「軸ごとのfloor積」を使う。
  // 実訪問数はceilベースでこれよりやや多いが、アルゴリズム選択の閾値
  // （edgeDensity > 0.4 等）が旧実装のこの分母を前提に調整されているため踏襲する
  const sampled =
    Math.floor((height - 2) / sampleRate) * Math.floor((width - 2) / sampleRate);

  return {
    edgeDensity: sampled > 0 ? edgeCount / sampled : 0,
    avgContrast: sampled > 0 ? contrastSum / sampled : 0,
  };
}

const KERNELS: Record<"sobel" | "prewitt", { x: number[][]; y: number[][] }> = {
  sobel: {
    x: [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]],
    y: [[-1, -2, -1], [0, 0, 0], [1, 2, 1]],
  },
  prewitt: {
    x: [[-1, 0, 1], [-1, 0, 1], [-1, 0, 1]],
    y: [[-1, -1, -1], [0, 0, 0], [1, 1, 1]],
  },
};

const LAPLACIAN_KERNEL = [[0, -1, 0], [-1, 4, -1], [0, -1, 0]];

/** 指定アルゴリズムでエッジマップを生成 */
export function detectEdges(
  image: ImageBuffer,
  algorithm: EdgeAlgorithm,
  threshold: number
): Uint8Array {
  const { width, height } = image;
  const gray = toGrayscale(image);
  const edges = new Uint8Array(width * height);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let magnitude: number;
      if (algorithm === "laplacian") {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            sum += gray[(y + ky) * width + (x + kx)] * LAPLACIAN_KERNEL[ky + 1][kx + 1];
          }
        }
        magnitude = Math.abs(sum);
      } else {
        const kernel = KERNELS[algorithm];
        let gx = 0;
        let gy = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const g = gray[(y + ky) * width + (x + kx)];
            gx += g * kernel.x[ky + 1][kx + 1];
            gy += g * kernel.y[ky + 1][kx + 1];
          }
        }
        magnitude = Math.sqrt(gx * gx + gy * gy);
      }
      if (magnitude > threshold) edges[y * width + x] = 1;
    }
  }
  return edges;
}

/**
 * 自動アウトライン（ドット絵スタイル用）。
 * 画像の複雑さでアルゴリズムと閾値を自動選択し、黒線を描画する。
 */
export function addOutlineInPlace(image: ImageBuffer, pixelSize: number): void {
  const { width, height, data } = image;
  const { edgeDensity, avgContrast } = analyzeImageCharacteristics(image);

  // 複雑さに基づくアルゴリズム選択
  let algorithm: EdgeAlgorithm;
  let threshold: number;
  if (edgeDensity > 0.4) {
    algorithm = "laplacian"; // 細かい画像: シャープで細い線
    threshold = 40;
  } else if (edgeDensity > 0.2) {
    algorithm = "sobel"; // 中間: バランス
    threshold = 25;
  } else {
    algorithm = "prewitt"; // シンプル: ソフト
    threshold = 20;
  }

  // コントラストで閾値補正
  if (avgContrast < 30) {
    threshold = Math.max(15, threshold - 10);
  } else if (avgContrast > 80) {
    threshold = Math.min(60, threshold + 10);
  }

  // ピクセルサイズで線の太さを決定
  const lineThickness = pixelSize >= 12 ? 2 : 1;

  const edges = detectEdges(image, algorithm, threshold);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (!edges[y * width + x]) continue;
      for (let ty = 0; ty < lineThickness; ty++) {
        for (let tx = 0; tx < lineThickness; tx++) {
          const dx = x + tx;
          const dy = y + ty;
          if (dx < width && dy < height) {
            const idx = (dy * width + dx) * 4;
            data[idx] = 0;
            data[idx + 1] = 0;
            data[idx + 2] = 0;
          }
        }
      }
    }
  }
}

/**
 * ソフトアウトライン（手描き風用の軽い縁取り。旧addSoftOutline）。
 * 上下左右の色差が閾値40を超えるピクセルを暗いグレー(50,50,50)にする。
 */
export function addSoftOutlineInPlace(image: ImageBuffer): void {
  const { width, height, data } = image;
  const edges: number[] = [];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const ci = (y * width + x) * 4;
      let maxDiff = 0;
      const neighbors = [
        (y * width + x - 1) * 4,
        (y * width + x + 1) * 4,
        ((y - 1) * width + x) * 4,
        ((y + 1) * width + x) * 4,
      ];
      for (const ni of neighbors) {
        const diff =
          Math.abs(data[ci] - data[ni]) +
          Math.abs(data[ci + 1] - data[ni + 1]) +
          Math.abs(data[ci + 2] - data[ni + 2]);
        if (diff > maxDiff) maxDiff = diff;
      }
      if (maxDiff > 40) edges.push(ci);
    }
  }

  for (const idx of edges) {
    data[idx] = 50;
    data[idx + 1] = 50;
    data[idx + 2] = 50;
  }
}
