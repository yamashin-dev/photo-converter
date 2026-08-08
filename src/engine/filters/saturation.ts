import type { ImageBuffer } from "../image";
import { clamp255 } from "../color";

/** RGB(0-255) → HSV(h:0-360, s:0-1, v:0-1) */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;

  let h: number;
  if (delta === 0) {
    h = 0;
  } else if (max === rn) {
    h = 60 * (((gn - bn) / delta) % 6);
  } else if (max === gn) {
    h = 60 * ((bn - rn) / delta + 2);
  } else {
    h = 60 * ((rn - gn) / delta + 4);
  }
  if (h < 0) h += 360;

  const s = max === 0 ? 0 : delta / max;
  return [h, s, max];
}

/** HSV → RGB(0-255) */
export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r: number, g: number, b: number;
  if (h < 60) {
    [r, g, b] = [c, x, 0];
  } else if (h < 120) {
    [r, g, b] = [x, c, 0];
  } else if (h < 180) {
    [r, g, b] = [0, c, x];
  } else if (h < 240) {
    [r, g, b] = [0, x, c];
  } else if (h < 300) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  return [clamp255((r + m) * 255), clamp255((g + m) * 255), clamp255((b + m) * 255)];
}

/**
 * 彩度スケーリング（統合UIの彩度スライダー 0-200% 用）。
 * PIL の ImageEnhance.Color と同じ「グレースケールとのブレンド」方式
 * （旧convert-photo-drawing互換）。factor=1.0 で変更なし、0でモノクロ、2で2倍。
 */
export function applySaturationInPlace(image: ImageBuffer, percent: number): void {
  if (percent === 100) return;
  const factor = percent / 100;
  const { data } = image;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = clamp255(gray + factor * (data[i] - gray));
    data[i + 1] = clamp255(gray + factor * (data[i + 1] - gray));
    data[i + 2] = clamp255(gray + factor * (data[i + 2] - gray));
  }
}

/**
 * 彩度強調（旧convert.php:926-993 enhanceSaturation から移植）。
 * 明度に応じた調整係数と色相別ブーストで自然に強調する。
 * 統合UIでは彩度スライダーが標準だが、「ビビッド」的なワンタッチ強調として残している。
 */
export function enhanceSaturationInPlace(image: ImageBuffer): void {
  const { data } = image;

  for (let i = 0; i < data.length; i += 4) {
    const [h, s0, v] = rgbToHsv(data[i], data[i + 1], data[i + 2]);

    // グレースケール（彩度0.05以下）は対象外
    if (s0 <= 0.05) continue;

    // 明るい色ほど強く強調（0.3〜1.0）
    const brightnessFactor = 0.3 + v * 0.7;

    // 色相別ブースト
    let colorBoost = 1.0;
    if ((h >= 0 && h < 30) || (h >= 330 && h < 360)) {
      colorBoost = 1.2; // 赤系
    } else if (h >= 30 && h < 90) {
      colorBoost = 1.15; // 黄・緑系
    } else if (h >= 90 && h < 150) {
      colorBoost = 1.15; // 緑系
    } else if (h >= 180 && h < 240) {
      colorBoost = 1.25; // 青・水色系
    }

    // 彩度帯に応じた倍率
    let s: number;
    if (s0 < 0.6) {
      s = Math.min(1, s0 * (1 + 0.6 * brightnessFactor * colorBoost));
    } else if (s0 < 0.8) {
      s = Math.min(1, s0 * (1 + 0.3 * brightnessFactor * colorBoost));
    } else {
      s = Math.min(1, s0 * (1 + 0.1 * colorBoost));
    }

    const [r, g, b] = hsvToRgb(h, s, v);
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}
