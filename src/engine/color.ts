import type { RGB, Palette } from "./types";

/**
 * 2色間の距離の2乗（ユークリッド距離）。
 *
 * 旧実装ではディザリング有無で距離基準が不統一だった
 * （非ディザ経路はユークリッド、ディザ経路は実質マンハッタン）。
 * エンジン全体でこの関数のみを使い、基準を統一する。
 */
export function colorDistanceSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

/** パレット内で最も近い色のインデックスを返す */
export function findClosestIndex(color: RGB, palette: Palette): number {
  let minDist = Infinity;
  let closest = 0;
  for (let i = 0; i < palette.length; i++) {
    const d = colorDistanceSq(color, palette[i]);
    if (d < minDist) {
      minDist = d;
      closest = i;
      if (d === 0) break;
    }
  }
  return closest;
}

/** 0-255 に丸めてクランプ */
export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}
