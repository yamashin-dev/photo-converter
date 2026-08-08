import type { ConversionParams, PaletteType } from "../types";
import { MIN_NUM_COLORS, MAX_NUM_COLORS } from "../types";
import { FIXED_PALETTES } from "../palettes/fixed";

/**
 * パラメータの実行時サニタイズ（全スタイル共通）。
 * paletteType等はpostMessage経由の実行時データ（localStorageの旧設定・
 * バージョン差のUI由来）なので、型定義だけでは守れない。
 * 旧PHP実装のallowlistフォールバック（不正値→デフォルト）を踏襲する。
 */
export function sanitizeParams(params: ConversionParams): ConversionParams {
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
