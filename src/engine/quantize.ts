import type { Palette } from "./types";
import type { ImageBuffer } from "./image";
import { findClosestIndex } from "./color";

/**
 * 全ピクセルをパレットの最近傍色に変換する（インプレース）。
 * 同一色の再計算を避ける色キャッシュ付き（旧convert.php:1943-1975と同じ戦略）。
 */
export function applyPaletteInPlace(image: ImageBuffer, palette: Palette): void {
  const { data } = image;
  const cache = new Map<number, number>(); // RGB24 -> パレットインデックス

  for (let i = 0; i < data.length; i += 4) {
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let paletteIndex = cache.get(key);
    if (paletteIndex === undefined) {
      paletteIndex = findClosestIndex({ r: data[i], g: data[i + 1], b: data[i + 2] }, palette);
      cache.set(key, paletteIndex);
    }
    const c = palette[paletteIndex];
    data[i] = c.r;
    data[i + 1] = c.g;
    data[i + 2] = c.b;
  }
}
