import { clamp255 } from "../color";

/**
 * 色空間変換（OpenCVのcvtColor 8U実装に準拠）。
 *
 * LAB: OpenCVはsRGBガンマ補正を行わずXYZ行列を直接適用する仕様のため、
 * それに合わせている（cvtColorの既知の仕様）。8Uスケーリングは
 * L←L*255/100, a←a+128, b←b+128。
 * YUV: Y=0.299R+0.587G+0.114B, U=0.492(B-Y)+128, V=0.877(R-Y)+128。
 */

const LAB_DELTA = 0.008856; // (6/29)^3
const XN = 0.950456;
const ZN = 1.088754;

function labF(t: number): number {
  return t > LAB_DELTA ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

function labFInv(t: number): number {
  const t3 = t * t * t;
  return t3 > LAB_DELTA ? t3 : (t - 16 / 116) / 7.787;
}

/** RGB(0-255) → LAB(8Uスケール: L,a,b すべて0-255) */
export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  const x = (0.412453 * rn + 0.35758 * gn + 0.180423 * bn) / XN;
  const y = 0.212671 * rn + 0.71516 * gn + 0.072169 * bn;
  const z = (0.019334 * rn + 0.119193 * gn + 0.950227 * bn) / ZN;

  const fy = labF(y);
  const L = y > LAB_DELTA ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
  const a = 500 * (labF(x) - fy);
  const bb = 200 * (fy - labF(z));

  return [clamp255((L * 255) / 100), clamp255(a + 128), clamp255(bb + 128)];
}

/** LAB(8Uスケール) → RGB(0-255) */
export function labToRgb(L8: number, a8: number, b8: number): [number, number, number] {
  const L = (L8 * 100) / 255;
  const a = a8 - 128;
  const b = b8 - 128;

  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;

  const y = L > 8 ? fy * fy * fy : L / 903.3;
  const x = labFInv(fx) * XN;
  const z = labFInv(fz) * ZN;

  const rn = 3.240479 * x - 1.53715 * y - 0.498535 * z;
  const gn = -0.969256 * x + 1.875991 * y + 0.041556 * z;
  const bn = 0.055648 * x - 0.204043 * y + 1.057311 * z;

  return [clamp255(rn * 255), clamp255(gn * 255), clamp255(bn * 255)];
}

/** RGB(0-255) → YUV(8U, U/Vは+128オフセット) */
export function rgbToYuv(r: number, g: number, b: number): [number, number, number] {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const u = 0.492 * (b - y) + 128;
  const v = 0.877 * (r - y) + 128;
  return [clamp255(y), clamp255(u), clamp255(v)];
}

/** YUV(8U) → RGB(0-255) */
export function yuvToRgb(y: number, u: number, v: number): [number, number, number] {
  const r = y + 1.14 * (v - 128);
  const g = y - 0.395 * (u - 128) - 0.581 * (v - 128);
  const b = y + 2.032 * (u - 128);
  return [clamp255(r), clamp255(g), clamp255(b)];
}
