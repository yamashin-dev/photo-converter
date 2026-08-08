/**
 * フレームワーク非依存の画像バッファ。
 * ブラウザの ImageData と同じメモリレイアウト（RGBA順）だが、
 * DOM に依存しないため Node 上のテストでもそのまま使える。
 */
export interface ImageBuffer {
  width: number;
  height: number;
  /** RGBA順、長さ = width * height * 4 */
  data: Uint8ClampedArray;
}

export function createImage(width: number, height: number): ImageBuffer {
  if (width < 1 || height < 1 || !Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error(`不正な画像サイズ: ${width}x${height}`);
  }
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneImage(src: ImageBuffer): ImageBuffer {
  return { width: src.width, height: src.height, data: new Uint8ClampedArray(src.data) };
}

/**
 * ニアレストネイバー法でリサイズ。
 * 整数倍拡大では完全なブロック複製になり、ドットのエッジが保たれる。
 *
 * 意図的差分: 旧GD（imagecopyresized）は非整数倍時に端数を画像全体へ
 * 分配するため、floor(x*sw/dw) の標準マッピングとはサンプル元が
 * 1px ずれることがある。視覚上は等価であり、本エンジンのゴールデンテストは
 * この実装を基準とする（旧PHP出力とのビット一致は目標にしない）。
 */
export function resizeNearest(src: ImageBuffer, dstWidth: number, dstHeight: number): ImageBuffer {
  const dst = createImage(dstWidth, dstHeight);
  const { width: sw, height: sh, data: sd } = src;
  const dd = dst.data;

  for (let y = 0; y < dstHeight; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dstHeight));
    for (let x = 0; x < dstWidth; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dstWidth));
      const si = (sy * sw + sx) * 4;
      const di = (y * dstWidth + x) * 4;
      dd[di] = sd[si];
      dd[di + 1] = sd[si + 1];
      dd[di + 2] = sd[si + 2];
      dd[di + 3] = sd[si + 3];
    }
  }
  return dst;
}

/** グレースケール輝度（ITU-R BT.601、旧実装と同一係数） */
export function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
