import type { RGB, Palette, ExtractMethod } from "../types";
import type { ImageBuffer } from "../image";
import { colorDistanceSq } from "../color";

/**
 * 自動パレット抽出（旧convert.php:230-575 から移植）。
 * MedianCut / Popularity / Luminance の3方式。
 * K-means は手描き風スタイルと合わせて Phase 2 で追加する。
 */

const SAMPLE_LIMIT = 10000;
const GRAY_FILL: RGB = { r: 128, g: 128, b: 128 };

/** 画像から最大1万ピクセルを等間隔サンプリング */
function samplePixels(image: ImageBuffer): RGB[] {
  const { width, height, data } = image;
  const total = width * height;
  const step = Math.max(1, Math.floor(total / Math.min(SAMPLE_LIMIT, total)));
  const pixels: RGB[] = [];
  for (let i = 0; i < total; i += step) {
    const idx = i * 4;
    pixels.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2] });
  }
  return pixels;
}

/** 16段階に量子化した色の出現頻度マップ */
function quantizedHistogram(pixels: RGB[]): (RGB & { count: number })[] {
  const counts = new Map<number, RGB & { count: number }>();
  for (const p of pixels) {
    const qr = Math.floor(p.r / 16) * 16;
    const qg = Math.floor(p.g / 16) * 16;
    const qb = Math.floor(p.b / 16) * 16;
    const key = (qr << 16) | (qg << 8) | qb;
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
    } else {
      counts.set(key, { r: qr, g: qg, b: qb, count: 1 });
    }
  }
  return [...counts.values()];
}

/** グレースケールのデフォルトパレット（サンプルが取れない場合の保険） */
function defaultPalette(numColors: number): Palette {
  const palette: RGB[] = [];
  for (let i = 0; i < numColors; i++) {
    const v = Math.floor((i / (numColors - 1)) * 255);
    palette.push({ r: v, g: v, b: v });
  }
  return palette;
}

/** 色数をちょうどnumColorsに揃える（超過はカット、不足はグレー補完） */
function padToExact(palette: RGB[], numColors: number): Palette {
  if (palette.length > numColors) return palette.slice(0, numColors);
  while (palette.length < numColors) palette.push({ ...GRAY_FILL });
  return palette;
}

/** MedianCut法: RGB空間を最大レンジ軸で再帰分割し、各ボックスの平均色を採用 */
export function extractMedianCut(image: ImageBuffer, numColors: number): Palette {
  const pixels = samplePixels(image);
  if (pixels.length === 0) return defaultPalette(numColors);

  const boxes: RGB[][] = [pixels];

  while (boxes.length < numColors) {
    // 最も広い色レンジを持つボックスを探す
    let maxRange = -1;
    let maxBoxIndex = -1;
    let maxChannel: keyof RGB = "r";

    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (box.length <= 1) continue;

      let minR = box[0].r, maxR = box[0].r;
      let minG = box[0].g, maxG = box[0].g;
      let minB = box[0].b, maxB = box[0].b;
      for (const p of box) {
        if (p.r < minR) minR = p.r;
        if (p.r > maxR) maxR = p.r;
        if (p.g < minG) minG = p.g;
        if (p.g > maxG) maxG = p.g;
        if (p.b < minB) minB = p.b;
        if (p.b > maxB) maxB = p.b;
      }
      const rangeR = maxR - minR;
      const rangeG = maxG - minG;
      const rangeB = maxB - minB;
      const currentMax = Math.max(rangeR, rangeG, rangeB);
      if (currentMax > maxRange) {
        maxRange = currentMax;
        maxBoxIndex = i;
        maxChannel = rangeR >= rangeG && rangeR >= rangeB ? "r" : rangeG >= rangeB ? "g" : "b";
      }
    }

    if (maxBoxIndex === -1) break; // これ以上分割できない

    // 中央値で分割
    const box = boxes[maxBoxIndex];
    const sorted = [...box].sort((a, b) => a[maxChannel] - b[maxChannel]);
    const median = Math.floor(sorted.length / 2);
    boxes.splice(maxBoxIndex, 1, sorted.slice(0, median), sorted.slice(median));
  }

  const palette: RGB[] = [];
  for (const box of boxes) {
    if (box.length === 0) continue;
    let sumR = 0, sumG = 0, sumB = 0;
    for (const p of box) {
      sumR += p.r;
      sumG += p.g;
      sumB += p.b;
    }
    palette.push({
      r: Math.floor(sumR / box.length),
      g: Math.floor(sumG / box.length),
      b: Math.floor(sumB / box.length),
    });
  }
  return padToExact(palette, numColors);
}

/** Popularity法: 出現頻度上位から、色の多様性（最小距離）を確保しつつ選択 */
export function extractPopularity(image: ImageBuffer, numColors: number): Palette {
  const pixels = samplePixels(image);
  if (pixels.length === 0) return defaultPalette(numColors);

  const histogram = quantizedHistogram(pixels).sort((a, b) => b.count - a.count);

  const palette: RGB[] = [];
  const selected: (RGB & { count: number })[] = [];

  if (histogram.length > 0) {
    palette.push({ r: histogram[0].r, g: histogram[0].g, b: histogram[0].b });
    selected.push(histogram[0]);
  }

  // 距離閾値1000（≒各チャンネル31差）で多様性を確保
  const DIVERSITY_THRESHOLD = 1000;
  for (const candidate of histogram) {
    if (palette.length >= numColors) break;
    let minDist = Infinity;
    for (const s of selected) {
      minDist = Math.min(minDist, colorDistanceSq(candidate, s));
    }
    if (minDist > DIVERSITY_THRESHOLD || candidate.count > histogram[0].count * 0.3) {
      palette.push({ r: candidate.r, g: candidate.g, b: candidate.b });
      selected.push(candidate);
    }
  }

  // 不足分は頻度順で未選択の色から補完
  for (const candidate of histogram) {
    if (palette.length >= numColors) break;
    const exists = selected.some(
      (s) => s.r === candidate.r && s.g === candidate.g && s.b === candidate.b
    );
    if (!exists) {
      palette.push({ r: candidate.r, g: candidate.g, b: candidate.b });
      selected.push(candidate);
    }
  }

  return padToExact(palette, numColors);
}

/** Luminance法: 明度順にソートして等間隔に選択（最速） */
export function extractLuminance(image: ImageBuffer, numColors: number): Palette {
  const pixels = samplePixels(image);
  if (pixels.length === 0) return defaultPalette(numColors);

  const histogram = quantizedHistogram(pixels);
  if (histogram.length === 0) return defaultPalette(numColors);

  histogram.sort((a, b) => a.r + a.g + a.b - (b.r + b.g + b.b));

  const palette: RGB[] = [];
  const step = Math.max(1, Math.floor(histogram.length / numColors));
  for (let i = 0; i < numColors && i * step < histogram.length; i++) {
    const idx = Math.min(i * step, histogram.length - 1);
    palette.push({ r: histogram[idx].r, g: histogram[idx].g, b: histogram[idx].b });
  }
  return padToExact(palette, numColors);
}

export function extractPalette(
  image: ImageBuffer,
  numColors: number,
  method: ExtractMethod
): Palette {
  switch (method) {
    case "mediancut":
      return extractMedianCut(image, numColors);
    case "popularity":
      return extractPopularity(image, numColors);
    case "luminance":
      return extractLuminance(image, numColors);
    case "kmeans":
      // Phase 2（手描き風スタイル移植）で実装。それまではMedianCutで代替
      return extractMedianCut(image, numColors);
  }
}
