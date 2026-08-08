import type { ConversionParams, Palette, PaletteType, ProgressCallback } from "../types";
import { DEFAULT_SEED } from "../types";
import type { ImageBuffer } from "../image";
import { resizeNearest } from "../image";
import { FIXED_PALETTES } from "../palettes/fixed";
import { extractKMeans } from "../palettes/kmeans";
import { applyPaletteInPlace } from "../quantize";
import { applySaturationInPlace } from "../filters/saturation";
import { addDoGOutlineInPlace } from "../filters/outline";
import { applyDitheringInPlace } from "../dithering";
import {
  gaussianBlurImage,
  bilateralFilterImage,
  medianBlurImage,
} from "../filters/convolution";
import { claheChannel, equalizeHistChannel } from "../filters/clahe";
import { rgbToLab, labToRgb, rgbToYuv, yuvToRgb } from "../filters/colorspace";
import { createRng } from "../random";
import { sanitizeParams } from "./sanitize";

/**
 * 手描き風イラスト変換の処理解像度上限。
 * bilateralフィルタ（9x9円形近傍）が全ピクセルに走るため、
 * ドット絵スタイルより低い上限にする（旧16bit smoothの1200px制限と同水準）。
 */
const ILLUSTRATION_MAX_DIMENSION = 1600;

/** LAB経由でLチャンネルだけを処理するヘルパー */
function processLightness(
  image: ImageBuffer,
  fn: (l: Uint8Array, length: number) => void
): void {
  const { width, height, data } = image;
  const n = width * height;
  const lCh = new Uint8Array(n);
  const aCh = new Uint8Array(n);
  const bCh = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const [l, a, b] = rgbToLab(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    lCh[i] = l;
    aCh[i] = a;
    bCh[i] = b;
  }
  fn(lCh, n);
  for (let i = 0; i < n; i++) {
    const [r, g, b] = labToRgb(lCh[i], aCh[i], bCh[i]);
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
  }
}

/**
 * 前処理（旧pixel_converter.py _preprocess から移植）:
 * ガウシアン(9x9) → bilateral(9,75,75) → メディアン(5)
 * → [contrast時] CLAHE(4.0, 8x8タイル, LABのL) + equalizeHist(YUVのY)
 * → 影除去（LABのLをガンマ0.4で持ち上げて平坦化）
 */
function preprocess(src: ImageBuffer, enhanceContrast: boolean): ImageBuffer {
  // 情報の簡素化（デフォルメ風）
  let img = gaussianBlurImage(src, 9, 0);
  // エッジ保持平滑化（手描き風の要）
  img = bilateralFilterImage(img, 9, 75, 75);
  // ノイズ除去
  img = medianBlurImage(img, 5);

  if (enhanceContrast) {
    // CLAHE: 細かな階調を統合して簡素化
    processLightness(img, (l) => claheChannel(l, img.width, img.height, 4.0, 8, 8));

    // equalizeHistで追加のコントラスト強調（YUVのYチャンネル）
    const { width, height, data } = img;
    const n = width * height;
    const yCh = new Uint8Array(n);
    const uCh = new Uint8Array(n);
    const vCh = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const [y, u, v] = rgbToYuv(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      yCh[i] = y;
      uCh[i] = u;
      vCh[i] = v;
    }
    equalizeHistChannel(yCh, n);
    for (let i = 0; i < n; i++) {
      const [r, g, b] = yuvToRgb(yCh[i], uCh[i], vCh[i]);
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
    }
  }

  // 影除去: 暗部を持ち上げて平坦に（ガンマ0.4）
  processLightness(img, (l, n) => {
    for (let i = 0; i < n; i++) {
      l[i] = Math.min(255, Math.round(Math.pow(l[i] / 255, 0.4) * 255));
    }
  });

  return img;
}

/**
 * 手描き風イラスト変換パイプライン（illustration）。
 *
 * 処理順序は旧pixel_converter.py _convert_single を踏襲:
 *   前処理 → NEAREST縮小 → パレット抽出+量子化(ディザ) → 彩度
 *   → 微細テクスチャ除去 → DoGアウトライン → NEAREST拡大
 *
 * 旧実装からの意図的差分:
 * - K-meansの乱数がsklearnと異なる（本エンジン内では決定的）
 * - 固定パレットは統合版の8種（旧drawing版の3種は品質問題があり廃止:
 *   famicomは重複色あり、gameboyは4色の単純反復）
 * - ディザリングは統合エンジンの9種が使える（旧drawingは3種）
 * - 微細テクスチャ除去がディザ後に走り色が混ざる点は旧実装どおり
 *   （手描き風スタイルはパレット厳守より柔らかさを優先する設計）
 */
export function convertIllustration(
  src: ImageBuffer,
  rawParams: ConversionParams,
  onProgress?: ProgressCallback
): ImageBuffer {
  if (rawParams.style !== "illustration") {
    throw new Error(`convertIllustrationは手描き風スタイル専用です: ${rawParams.style}`);
  }
  const params = sanitizeParams(rawParams);
  const rng = createRng(params.seed ?? DEFAULT_SEED);
  const seed = params.seed ?? DEFAULT_SEED;

  // 0. 端末保護: 処理解像度の上限
  const maxDim = params.maxDimension ?? ILLUSTRATION_MAX_DIMENSION;
  let source = src;
  if (src.width > maxDim || src.height > maxDim) {
    onProgress?.({ ratio: 0.02, stage: "decode" });
    const scale = Math.min(maxDim / src.width, maxDim / src.height);
    source = resizeNearest(
      src,
      Math.max(1, Math.floor(src.width * scale)),
      Math.max(1, Math.floor(src.height * scale))
    );
  }

  // 1. 前処理（ぼかし・エッジ保持平滑化・影除去）— 最も重い工程
  onProgress?.({ ratio: 0.1, stage: "preprocess" });
  const processed = preprocess(source, params.enhanceContrast);

  // 2. NEAREST縮小（デフォルメ風に）
  onProgress?.({ ratio: 0.55, stage: "downscale" });
  const smallWidth = Math.max(1, Math.floor(processed.width / params.pixelSize));
  const smallHeight = Math.max(1, Math.floor(processed.height / params.pixelSize));
  const small = resizeNearest(processed, smallWidth, smallHeight);

  // 3. パレット決定（autoはK-means、固定は統合版パレット）
  onProgress?.({ ratio: 0.6, stage: "palette" });
  const palette: Palette =
    params.paletteType === "auto"
      ? extractKMeans(small, params.numColors, seed)
      : FIXED_PALETTES[params.paletteType as Exclude<PaletteType, "auto">];

  // 4. 量子化（ディザなし=最近傍、あり=各方式）
  onProgress?.({ ratio: 0.7, stage: "quantize" });
  if (params.dithering === "none") {
    applyPaletteInPlace(small, palette);
  } else {
    applyDitheringInPlace(small, palette, params.dithering, rng);
  }

  // 5. 彩度調整（手描き風は少し下げるのが定番。100=変更なし）
  if (params.saturation !== 100) {
    onProgress?.({ ratio: 0.78, stage: "saturate" });
    applySaturationInPlace(small, params.saturation);
  }

  // 6. 微細テクスチャ除去（ガウシアン5x5 + メディアン3）
  onProgress?.({ ratio: 0.82, stage: "preprocess" });
  let textured = gaussianBlurImage(small, 5, 0);
  textured = medianBlurImage(textured, 3);

  // 7. DoGアウトライン（柔らかい輪郭線）
  if (params.outline !== "none") {
    onProgress?.({ ratio: 0.88, stage: "outline" });
    addDoGOutlineInPlace(textured);
  }

  // 8. NEAREST拡大（クリアな線を保つ）
  onProgress?.({ ratio: 0.95, stage: "upscale" });
  const result = resizeNearest(textured, source.width, source.height);

  onProgress?.({ ratio: 1, stage: "upscale" });
  return result;
}

/** テスト用に前処理単体もエクスポート */
export const _internals = { preprocess };
