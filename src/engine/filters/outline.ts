import type { ImageBuffer } from "../image";
import { luma } from "../image";
import { gaussianBlurChannel } from "./convolution";

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

/** 輪郭として黒で塗る画素の割合の目安 */
const OUTLINE_COVERAGE = 0.055;

/**
 * 自動アウトライン（ドット絵スタイル用）。
 *
 * 勾配の強い順に、画像全体の一定割合だけを輪郭として塗る。
 *
 * 旧実装は固定閾値（画像特性で20〜60に調整）で判定していたが、
 * この方式は減色後の画像と相性が悪い。減色後は「広い平坦域＋急な段差」に
 * なるため平均コントラストが低く出て、「低コントラストだから閾値を下げる」
 * 分岐が働き、色の境界が軒並み輪郭と判定されて画面が黒く潰れていた
 * （旧実装でも pixelSize=16 で画素の68%が黒になっていた）。
 * 割合で決めれば、どんな画像でも線の量が一定に保たれる。
 *
 * @param edgeSource エッジ判定に使う画像。減色前の階調が残ったものを渡すと
 *                   境界がより正確に出る。省略時は描画対象と同じ画像を使う
 */
export function addOutlineInPlace(
  image: ImageBuffer,
  pixelSize: number,
  edgeSource: ImageBuffer = image
): void {
  const { width, height, data } = image;
  const magnitude = sobelMagnitude(edgeSource);

  // 勾配強度のヒストグラムから、上位 OUTLINE_COVERAGE 分の閾値を求める
  const BINS = 512;
  let maxMag = 0;
  for (const m of magnitude) if (m > maxMag) maxMag = m;
  if (maxMag <= 0) return; // 完全に平坦な画像には線を引かない

  const hist = new Uint32Array(BINS);
  for (const m of magnitude) {
    hist[Math.min(BINS - 1, Math.floor((m / maxMag) * (BINS - 1)))]++;
  }
  const target = Math.floor(magnitude.length * OUTLINE_COVERAGE);
  let acc = 0;
  let bin = BINS - 1;
  while (bin > 0 && acc + hist[bin] <= target) {
    acc += hist[bin];
    bin--;
  }
  // 抜けたビンを含めると目標を超えるので、ひとつ上を閾値にする。
  // これにより「勾配がどこも同じ画像」では線が引かれない
  // （そういう画像に輪郭と呼べる境界は無い）
  let threshold = ((bin + 1) / (BINS - 1)) * maxMag;

  // ただし、それだと1画素も選ばれない場合がある。
  // 小さい画像やはっきりした境界だけの画像では、境界の画素数が
  // 目標割合を超えてしまうため。線が消えるよりは多少多くても引く
  if (acc === 0 && bin > 0) {
    threshold = (bin / (BINS - 1)) * maxMag;
  }

  // ドットが粗いほど線も太くしたくなるが、小さい画像で2pxは潰れるため1px固定
  void pixelSize;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      if (magnitude[y * width + x] < threshold) continue;
      const idx = (y * width + x) * 4;
      data[idx] = 0;
      data[idx + 1] = 0;
      data[idx + 2] = 0;
    }
  }
}

/** Sobelの勾配強度マップ（境界1画素は0のまま） */
function sobelMagnitude(image: ImageBuffer): Float32Array {
  const { width, height } = image;
  const gray = toGrayscale(image);
  const out = new Float32Array(width * height);
  const kx = KERNELS.sobel.x;
  const ky = KERNELS.sobel.y;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0;
      let gy = 0;
      for (let j = -1; j <= 1; j++) {
        for (let i = -1; i <= 1; i++) {
          const g = gray[(y + j) * width + (x + i)];
          gx += g * kx[j + 1][i + 1];
          gy += g * ky[j + 1][i + 1];
        }
      }
      out[y * width + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return out;
}

/**
 * DoG（Difference of Gaussians）アウトライン（旧drawing版の柔らかい輪郭線）。
 * σ1.0(5x5)とσ2.0(7x7)のガウシアン差分の絶対値が閾値10を超える画素を黒にする。
 */
export function addDoGOutlineInPlace(image: ImageBuffer): void {
  const { width, height, data } = image;
  const gray = toGrayscale(image);

  const blur1 = gaussianBlurChannel(gray, width, height, 5, 1.0);
  const blur2 = gaussianBlurChannel(gray, width, height, 7, 2.0);

  for (let i = 0; i < gray.length; i++) {
    if (Math.abs(blur1[i] - blur2[i]) > 10) {
      const p = i * 4;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
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
