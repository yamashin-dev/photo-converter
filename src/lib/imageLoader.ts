"use client";

/**
 * 画像ファイル → ImageData への変換。
 * - EXIF orientation を尊重（旧版は未対応で横向き写真が回転していた）
 * - HEIC/HEIF はブラウザが対応していない場合のみWASMデコーダを動的読み込み
 */

export const ACCEPTED_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif";

/** 端末保護のための入力側上限（長辺）。エンジン側にも別途上限がある */
const MAX_SOURCE_DIMENSION = 8192;

export class UnsupportedImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedImageError";
  }
}

function isHeic(file: File): boolean {
  const type = file.type.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

/** HEICをブラウザがそのままデコードできるか（Safari 17+など） */
async function canDecodeNatively(file: File): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(file);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

/** HEIC → Blob(PNG)。WASMデコーダはこの経路でのみ読み込む */
async function decodeHeic(file: File): Promise<Blob> {
  try {
    const mod = await import("heic-to");
    return await mod.heicTo({ blob: file, type: "image/png" });
  } catch {
    throw new UnsupportedImageError(
      "HEIC画像を読み込めませんでした。写真アプリでJPEGに変換してからお試しください。"
    );
  }
}

/**
 * ファイルからImageDataを作る。
 * imageOrientation: "from-image" でEXIFの回転を適用する。
 */
export async function loadImageData(file: File): Promise<ImageData> {
  let source: Blob = file;

  if (isHeic(file) && !(await canDecodeNatively(file))) {
    source = await decodeHeic(file);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  } catch {
    throw new UnsupportedImageError(
      "この画像を読み込めませんでした。JPEG / PNG / GIF / WebP / HEIC に対応しています。"
    );
  }

  // 極端に大きい画像は先に縮める（メモリ確保の失敗を防ぐ）
  let { width, height } = bitmap;
  if (width > MAX_SOURCE_DIMENSION || height > MAX_SOURCE_DIMENSION) {
    const scale = Math.min(MAX_SOURCE_DIMENSION / width, MAX_SOURCE_DIMENSION / height);
    width = Math.max(1, Math.floor(width * scale));
    height = Math.max(1, Math.floor(height * scale));
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    throw new UnsupportedImageError("この端末では画像処理を実行できませんでした。");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return ctx.getImageData(0, 0, width, height);
}

/** ImageData → Canvas（表示・書き出し用） */
export function imageDataToCanvas(data: ImageData): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  canvas.getContext("2d")!.putImageData(data, 0, 0);
  return canvas;
}

/** ImageData → Blob URL（<img> に流し込む用。呼び出し側でrevokeする） */
export async function imageDataToUrl(
  data: ImageData,
  type: "image/png" | "image/webp" = "image/png"
): Promise<string> {
  const canvas = imageDataToCanvas(data);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type));
  if (!blob) throw new Error("画像の書き出しに失敗しました");
  return URL.createObjectURL(blob);
}

/** ダウンロード用のBlobを作る（拡大倍率つき） */
export async function exportImage(
  data: ImageData,
  type: "image/png" | "image/webp",
  scale = 1
): Promise<Blob> {
  const base = imageDataToCanvas(data);
  let canvas = base;

  if (scale !== 1) {
    canvas = document.createElement("canvas");
    canvas.width = Math.round(base.width * scale);
    canvas.height = Math.round(base.height * scale);
    const ctx = canvas.getContext("2d")!;
    // ドットのエッジを保つ
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(base, 0, 0, canvas.width, canvas.height);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, type, type === "image/webp" ? 0.95 : undefined)
  );
  if (!blob) throw new Error("画像の書き出しに失敗しました");
  return blob;
}
