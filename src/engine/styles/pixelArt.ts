import type { ConversionParams, Palette, PaletteType, ProgressCallback } from "../types";
import { DEFAULT_SEED, DEFAULT_MAX_DIMENSION, MIN_NUM_COLORS, MAX_NUM_COLORS } from "../types";
import type { ImageBuffer } from "../image";
import { resizeNearest } from "../image";
import { FIXED_PALETTES } from "../palettes/fixed";
import { extractPalette } from "../palettes/extract";
import { applyPaletteInPlace } from "../quantize";
import { applySaturationInPlace } from "../filters/saturation";
import { addOutlineInPlace, addSoftOutlineInPlace } from "../filters/outline";
import { applyDitheringInPlace } from "../dithering";
import { createRng } from "../random";

/**
 * パラメータの実行時サニタイズ。
 * paletteType等はpostMessage経由の実行時データ（localStorageの旧設定・
 * バージョン差のUI由来）なので、型定義だけでは守れない。
 * 旧PHP実装のallowlistフォールバック（不正値→デフォルト）を踏襲する。
 */
function sanitizeParams(params: ConversionParams): ConversionParams {
  const paletteType: PaletteType =
    params.paletteType === "auto" || params.paletteType in FIXED_PALETTES
      ? params.paletteType
      : "famicom";
  const numColors = Math.min(
    MAX_NUM_COLORS,
    Math.max(MIN_NUM_COLORS, Math.floor(params.numColors) || 16)
  );
  const pixelSize = Math.min(32, Math.max(2, Math.floor(params.pixelSize) || 4));
  return { ...params, paletteType, numColors, pixelSize };
}

/**
 * ドット絵変換パイプライン（pixel-retro / pixel-integer）。
 *
 * 処理順序:
 *   上限縮小 → パレット決定 → 縮小 → 彩度 → パレット変換 → アウトライン → ディザリング → 拡大
 *
 * 旧仕様（SPECIFICATION.txt 16.1）からの意図的変更:
 * - 彩度調整をパレット変換の「前」に移動した。旧実装はパレット変換後に彩度を
 *   変更していたため、ディザなし時にパレット外の色が出力され
 *   「16色」のコンセプトが崩れていた（レビュー指摘の修正）
 * - アウトラインをディザ前に行う点は踏襲（ディザのドットをエッジ誤検出しないため）
 */
export function convertPixelArt(
  src: ImageBuffer,
  rawParams: ConversionParams,
  onProgress?: ProgressCallback
): ImageBuffer {
  if (rawParams.style !== "pixel-retro" && rawParams.style !== "pixel-integer") {
    throw new Error(`convertPixelArtはドット絵スタイル専用です: ${rawParams.style}`);
  }
  const params = sanitizeParams(rawParams);
  const rng = createRng(params.seed ?? DEFAULT_SEED);

  // 0. 端末保護: 処理解像度の上限（超過分はニアレスト縮小）
  const maxDim = params.maxDimension ?? DEFAULT_MAX_DIMENSION;
  let source = src;
  if (src.width > maxDim || src.height > maxDim) {
    onProgress?.({ ratio: 0.02, stage: "preprocess" });
    const scale = Math.min(maxDim / src.width, maxDim / src.height);
    source = resizeNearest(
      src,
      Math.max(1, Math.floor(src.width * scale)),
      Math.max(1, Math.floor(src.height * scale))
    );
  }

  // 1. パレット決定（autoは元画像から抽出、固定は定義済み16色）
  onProgress?.({ ratio: 0.05, stage: "palette" });
  const palette: Palette =
    params.paletteType === "auto"
      ? extractPalette(source, params.numColors, params.extractMethod)
      : FIXED_PALETTES[params.paletteType as Exclude<PaletteType, "auto">];

  // 2. ピクセルサイズ分の1に縮小（ニアレストでカクカクに）
  onProgress?.({ ratio: 0.2, stage: "downscale" });
  const smallWidth = Math.max(1, Math.floor(source.width / params.pixelSize));
  const smallHeight = Math.max(1, Math.floor(source.height / params.pixelSize));
  const small = resizeNearest(source, smallWidth, smallHeight);

  // 3. 彩度調整（パレット変換の前。変換後だとパレット外の色が出力されるため）
  if (params.saturation !== 100) {
    onProgress?.({ ratio: 0.3, stage: "saturate" });
    applySaturationInPlace(small, params.saturation);
  }

  // 4. パレット最近傍変換（色キャッシュ付き）
  onProgress?.({ ratio: 0.4, stage: "quantize" });
  applyPaletteInPlace(small, palette);

  // 5. アウトライン（ディザ前）
  if (params.outline !== "none") {
    onProgress?.({ ratio: 0.6, stage: "outline" });
    if (params.outline === "soft") {
      addSoftOutlineInPlace(small);
    } else {
      addOutlineInPlace(small, params.pixelSize);
    }
  }

  // 6. ディザリング
  if (params.dithering !== "none") {
    onProgress?.({ ratio: 0.7, stage: "dithering" });
    applyDitheringInPlace(small, palette, params.dithering, rng);
  }

  // 7. 拡大（integerは整数倍でエッジ完全シャープ、retroは処理解像度へ）
  onProgress?.({ ratio: 0.9, stage: "upscale" });
  const result =
    params.style === "pixel-integer"
      ? resizeNearest(small, smallWidth * params.pixelSize, smallHeight * params.pixelSize)
      : resizeNearest(small, source.width, source.height);

  onProgress?.({ ratio: 1, stage: "upscale" });
  return result;
}
