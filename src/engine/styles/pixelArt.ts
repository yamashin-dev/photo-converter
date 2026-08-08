import type { ConversionParams, Palette, ProgressCallback } from "../types";
import { DEFAULT_SEED } from "../types";
import type { ImageBuffer } from "../image";
import { resizeNearest } from "../image";
import { FIXED_PALETTES } from "../palettes/fixed";
import { extractPalette } from "../palettes/extract";
import { applyPaletteInPlace } from "../quantize";
import { applySaturationInPlace } from "../filters/saturation";
import { addOutlineInPlace } from "../filters/outline";
import { applyDitheringInPlace } from "../dithering";
import { createRng } from "../random";

/**
 * ドット絵変換パイプライン（pixel-retro / pixel-integer）。
 *
 * 処理順序は旧仕様（SPECIFICATION.txt 16.1）の設計意図を踏襲:
 *   縮小 → パレット変換 → 彩度 → アウトライン → ディザリング → 拡大
 * - 彩度をディザ前に行うのは、ディザ後に再変換すると
 *   パレット外の色が発生するため
 * - アウトラインをディザ前に行うのは、ディザのドットパターンを
 *   エッジと誤検出しないため
 */
export function convertPixelArt(
  src: ImageBuffer,
  params: ConversionParams,
  onProgress?: ProgressCallback
): ImageBuffer {
  if (params.style !== "pixel-retro" && params.style !== "pixel-integer") {
    throw new Error(`convertPixelArtはドット絵スタイル専用です: ${params.style}`);
  }
  const rng = createRng(params.seed ?? DEFAULT_SEED);

  // 1. パレット決定（autoは元画像から抽出、固定は定義済み16色）
  onProgress?.({ ratio: 0.05, stage: "palette" });
  const palette: Palette =
    params.paletteType === "auto"
      ? extractPalette(src, params.numColors, params.extractMethod)
      : FIXED_PALETTES[params.paletteType];

  // 2. ピクセルサイズ分の1に縮小（ニアレストでカクカクに）
  onProgress?.({ ratio: 0.2, stage: "downscale" });
  const smallWidth = Math.max(1, Math.floor(src.width / params.pixelSize));
  const smallHeight = Math.max(1, Math.floor(src.height / params.pixelSize));
  const small = resizeNearest(src, smallWidth, smallHeight);

  // 3. パレット最近傍変換（色キャッシュ付き）
  onProgress?.({ ratio: 0.35, stage: "quantize" });
  applyPaletteInPlace(small, palette);

  // 4. 彩度調整（ディザ前）
  if (params.saturation !== 100) {
    onProgress?.({ ratio: 0.5, stage: "saturate" });
    applySaturationInPlace(small, params.saturation);
  }

  // 5. アウトライン（ディザ前）
  if (params.outline !== "none") {
    onProgress?.({ ratio: 0.6, stage: "outline" });
    addOutlineInPlace(small, params.pixelSize);
  }

  // 6. ディザリング
  if (params.dithering !== "none") {
    onProgress?.({ ratio: 0.7, stage: "dithering" });
    applyDitheringInPlace(small, palette, params.dithering, rng);
  }

  // 7. 拡大（integerは整数倍でエッジ完全シャープ、retroは元サイズへ）
  onProgress?.({ ratio: 0.9, stage: "upscale" });
  const result =
    params.style === "pixel-integer"
      ? resizeNearest(small, smallWidth * params.pixelSize, smallHeight * params.pixelSize)
      : resizeNearest(small, src.width, src.height);

  onProgress?.({ ratio: 1, stage: "upscale" });
  return result;
}
