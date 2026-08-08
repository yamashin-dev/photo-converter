/**
 * ヒストグラム系のコントラスト強調（単一チャンネル 0-255）。
 * CLAHE（タイル分割適応ヒストグラム均等化）と equalizeHist。
 * OpenCVの実装（クリップ→再分配→タイルLUT→双線形補間）に準拠。
 */

/** グローバルなヒストグラム均等化（OpenCVのequalizeHist相当） */
export function equalizeHistChannel(
  channel: Uint8Array | Uint8ClampedArray,
  length: number
): void {
  const hist = new Uint32Array(256);
  for (let i = 0; i < length; i++) hist[channel[i]]++;

  // 最初の非ゼロビンを探す
  let firstNonZero = 0;
  while (firstNonZero < 256 && hist[firstNonZero] === 0) firstNonZero++;
  if (firstNonZero === 256) return;

  const cdfMin = hist[firstNonZero];
  const denom = length - cdfMin;
  if (denom === 0) return; // 全ピクセル同一値

  const lut = new Uint8Array(256);
  let cdf = 0;
  for (let i = 0; i < 256; i++) {
    cdf += hist[i];
    lut[i] = i < firstNonZero ? 0 : Math.round(((cdf - cdfMin) / denom) * 255);
  }
  for (let i = 0; i < length; i++) channel[i] = lut[channel[i]];
}

/**
 * CLAHE（Contrast Limited Adaptive Histogram Equalization）。
 * clipLimitはOpenCV同様「タイル面積比のクリップ上限」:
 * 実クリップ値 = max(1, clipLimit * tileArea / 256)
 */
export function claheChannel(
  channel: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  clipLimit: number,
  tilesX: number,
  tilesY: number
): void {
  const tileW = Math.ceil(width / tilesX);
  const tileH = Math.ceil(height / tilesY);

  // 各タイルのLUTを構築
  const luts: Uint8Array[] = [];
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(x0 + tileW, width);
      const y1 = Math.min(y0 + tileH, height);
      const area = (x1 - x0) * (y1 - y0);

      const hist = new Float64Array(256);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[channel[y * width + x]]++;
        }
      }

      // クリップと超過分の均等再分配
      const limit = Math.max(1, (clipLimit * area) / 256);
      let excess = 0;
      for (let i = 0; i < 256; i++) {
        if (hist[i] > limit) {
          excess += hist[i] - limit;
          hist[i] = limit;
        }
      }
      const redistribute = excess / 256;
      for (let i = 0; i < 256; i++) hist[i] += redistribute;

      // CDF → LUT
      const lut = new Uint8Array(256);
      const scale = 255 / area;
      let cdf = 0;
      for (let i = 0; i < 256; i++) {
        cdf += hist[i];
        const v = Math.round(cdf * scale);
        lut[i] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      luts.push(lut);
    }
  }

  // タイル間を双線形補間して適用
  const result = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    // タイル中心基準の連続座標
    const fy = y / tileH - 0.5;
    const ty0 = Math.max(0, Math.floor(fy));
    const ty1 = Math.min(tilesY - 1, ty0 + 1);
    const wy = Math.min(1, Math.max(0, fy - ty0));

    for (let x = 0; x < width; x++) {
      const fx = x / tileW - 0.5;
      const tx0 = Math.max(0, Math.floor(fx));
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const wx = Math.min(1, Math.max(0, fx - tx0));

      const v = channel[y * width + x];
      const v00 = luts[ty0 * tilesX + tx0][v];
      const v01 = luts[ty0 * tilesX + tx1][v];
      const v10 = luts[ty1 * tilesX + tx0][v];
      const v11 = luts[ty1 * tilesX + tx1][v];

      const top = v00 * (1 - wx) + v01 * wx;
      const bottom = v10 * (1 - wx) + v11 * wx;
      result[y * width + x] = Math.round(top * (1 - wy) + bottom * wy);
    }
  }
  channel.set(result);
}
