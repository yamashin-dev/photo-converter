/**
 * フォトチェンジ 変換エンジン 共通型定義
 *
 * エンジンはフレームワーク非依存の純TypeScriptモジュール。
 * UI層からは Web Worker 経由で呼び出す（メインスレッドをブロックしない）。
 */

/** RGB色。各チャンネル 0-255 の整数 */
export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** 固定長のカラーパレット */
export type Palette = readonly RGB[];

/** 変換スタイル（3種） */
export type ConversionStyle =
  | "pixel-retro" // ドット絵（レトロ）: 旧16bit retro
  | "pixel-integer" // ドット絵（整数倍）: 旧16bit integer
  | "illustration"; // 手描き風イラスト: 旧drawing + 旧16bit smooth 統合

/** 固定パレットの種類（旧16bit版の8種を継承。gameboyは重複色を修正済み） */
export type PaletteType =
  | "auto"
  | "famicom"
  | "gameboy"
  | "grayscale"
  | "warm"
  | "cool"
  | "vivid"
  | "sunset"
  | "forest";

/** 自動パレット抽出の方式（旧16bitの3種 + 旧drawingのK-means） */
export type ExtractMethod = "mediancut" | "popularity" | "luminance" | "kmeans";

/** ディザリング方式（旧16bit版の9種を継承） */
export type DitheringType =
  | "none"
  | "floyd-steinberg"
  | "riemersma"
  | "ordered-2x2"
  | "ordered-4x4"
  | "ordered-8x8"
  | "patterning-2x2"
  | "patterning-4x4"
  | "patterning-8x8";

/** アウトライン方式 */
export type OutlineType = "none" | "soft" | "auto";

/** 変換パラメータ（UIとエンジンで共有する契約） */
export interface ConversionParams {
  style: ConversionStyle;
  /** ピクセルサイズ（ドットの粗さ）: 2 | 4 | 8 | 12 | 16 */
  pixelSize: number;
  /** 色数: 4-64。ドット絵のデフォルトは16（「16bit風」コンセプト） */
  numColors: number;
  paletteType: PaletteType;
  /** paletteType === "auto" の時のみ有効 */
  extractMethod: ExtractMethod;
  dithering: DitheringType;
  outline: OutlineType;
  /** 彩度 0-200（%）。100 = 変更なし */
  saturation: number;
  /** コントラスト強化（CLAHE）。手描き風向け */
  enhanceContrast: boolean;
  /** 影除去（ガンマ補正による平坦化）。手描き風向け */
  removeShadow: boolean;
  /**
   * 乱数シード。同じシード + 同じ入力 → 必ず同じ出力（ゴールデンテストの前提）。
   * 省略時は DEFAULT_SEED。
   */
  seed?: number;
}

export const DEFAULT_SEED = 42;

/** 変換の進捗通知（Workerからメインスレッドへ） */
export interface ConversionProgress {
  /** 0-1 */
  ratio: number;
  /** 現在の処理段階（UI表示用） */
  stage:
    | "decode"
    | "preprocess"
    | "downscale"
    | "palette"
    | "quantize"
    | "saturate"
    | "outline"
    | "dithering"
    | "upscale"
    | "encode";
}

/** 進捗通知コールバック */
export type ProgressCallback = (progress: ConversionProgress) => void;
