import { describe, it, expect } from "vitest";
import {
  DEFAULT_PARAMS,
  hasParamKeys,
  paramsToQuery,
  queryToParams,
} from "../../src/lib/params";

describe("hasParamKeys", () => {
  it("設定キーを含むクエリだけtrue（レビュー指摘の回帰防止）", () => {
    expect(hasParamKeys("?s=illustration")).toBe(true);
    expect(hasParamKeys("?d=floyd-steinberg&sa=120")).toBe(true);
  });

  it("共有起動や計測用のクエリではfalse（保存設定を捨てない）", () => {
    expect(hasParamKeys("?shared=1")).toBe(false);
    expect(hasParamKeys("?utm_source=twitter&utm_medium=social")).toBe(false);
    expect(hasParamKeys("?fbclid=abc123")).toBe(false);
    expect(hasParamKeys("")).toBe(false);
  });
});

describe("paramsToQuery / queryToParams のラウンドトリップ", () => {
  it("既定値からの差分だけがクエリに出る", () => {
    expect(paramsToQuery(DEFAULT_PARAMS)).toBe("");
  });

  it("変更した設定が復元される", () => {
    const params = {
      ...DEFAULT_PARAMS,
      style: "illustration" as const,
      pixelSize: 8,
      numColors: 32,
      paletteType: "gameboy" as const,
      dithering: "ordered-4x4" as const,
      outline: "soft" as const,
      saturation: 130,
      enhanceContrast: true,
      removeShadow: false,
    };
    expect(queryToParams(paramsToQuery(params))).toEqual(params);
  });

  it("不正な値は既定値にフォールバックする", () => {
    const restored = queryToParams("?s=不正&p=999&n=7&pt=nope&d=bad&sa=9999");
    expect(restored.style).toBe(DEFAULT_PARAMS.style);
    expect(restored.pixelSize).toBe(DEFAULT_PARAMS.pixelSize);
    expect(restored.numColors).toBe(DEFAULT_PARAMS.numColors);
    expect(restored.paletteType).toBe(DEFAULT_PARAMS.paletteType);
    expect(restored.dithering).toBe(DEFAULT_PARAMS.dithering);
    expect(restored.saturation).toBe(DEFAULT_PARAMS.saturation);
  });

  it("無関係なクエリが混ざっても設定は読み取れる", () => {
    const restored = queryToParams("?utm_source=x&s=illustration&shared=1");
    expect(restored.style).toBe("illustration");
  });
});
