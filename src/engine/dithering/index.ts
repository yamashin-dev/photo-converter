import type { DitheringType, Palette } from "../types";
import type { ImageBuffer } from "../image";
import type { Rng } from "../random";
import { applyFloydSteinbergInPlace, applyRiemersmaInPlace } from "./errorDiffusion";
import { applyOrderedInPlace } from "./ordered";
import { applyPatterningInPlace } from "./patterning";

/**
 * ディザリングのディスパッチャ。
 * "none" の場合は何もしない（事前のパレット変換結果がそのまま使われる）。
 */
export function applyDitheringInPlace(
  image: ImageBuffer,
  palette: Palette,
  type: DitheringType,
  rng: Rng
): void {
  switch (type) {
    case "none":
      return;
    case "floyd-steinberg":
      return applyFloydSteinbergInPlace(image, palette);
    case "riemersma":
      return applyRiemersmaInPlace(image, palette);
    case "ordered-2x2":
      return applyOrderedInPlace(image, palette, "2x2", rng);
    case "ordered-4x4":
      return applyOrderedInPlace(image, palette, "4x4", rng);
    case "ordered-8x8":
      return applyOrderedInPlace(image, palette, "8x8", rng);
    case "patterning-2x2":
      return applyPatterningInPlace(image, palette, "2x2");
    case "patterning-4x4":
      return applyPatterningInPlace(image, palette, "4x4");
    case "patterning-8x8":
      return applyPatterningInPlace(image, palette, "8x8");
  }
}
