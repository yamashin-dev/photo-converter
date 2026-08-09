import type {
  ConversionParams,
  ConversionStyle,
  DitheringType,
  ExtractMethod,
  OutlineType,
  PaletteType,
} from "@/engine/types";

/** スタイルごとの初期値。手描き風は旧drawing版の既定値に合わせる */
export const DEFAULT_PARAMS: ConversionParams = {
  style: "pixel-retro",
  pixelSize: 4,
  numColors: 16,
  paletteType: "auto",
  extractMethod: "mediancut",
  dithering: "none",
  outline: "none",
  saturation: 100,
  enhanceContrast: false,
  removeShadow: true,
};

export const ILLUSTRATION_DEFAULTS: Partial<ConversionParams> = {
  numColors: 8,
  paletteType: "auto",
  extractMethod: "kmeans",
  outline: "soft",
  saturation: 90,
};

export const STYLE_OPTIONS: { value: ConversionStyle; label: string; hint: string }[] = [
  { value: "pixel-retro", label: "ドット絵", hint: "16bit機のようなレトロなピクセルアート" },
  { value: "pixel-integer", label: "ドット絵（くっきり）", hint: "ドットの境界が完全に揃う整数倍出力" },
  { value: "illustration", label: "手描き風", hint: "影を飛ばした柔らかいイラスト調" },
];

export const PALETTE_OPTIONS: { value: PaletteType; label: string }[] = [
  { value: "auto", label: "写真から自動抽出" },
  { value: "famicom", label: "ファミコン風" },
  { value: "gameboy", label: "ゲームボーイ風" },
  { value: "grayscale", label: "モノクロ" },
  { value: "warm", label: "セピア" },
  { value: "cool", label: "ブルー" },
  { value: "vivid", label: "ビビッド" },
  { value: "sunset", label: "夕焼け" },
  { value: "forest", label: "フォレスト" },
];

export const EXTRACT_OPTIONS: { value: ExtractMethod; label: string; hint: string }[] = [
  { value: "mediancut", label: "バランス", hint: "風景や色数の多い写真向け" },
  { value: "popularity", label: "主役重視", hint: "人物や物撮り向け" },
  { value: "luminance", label: "明暗重視", hint: "グラデーションが滑らかに出る" },
  { value: "kmeans", label: "色まとめ", hint: "似た色をまとめる。手描き風向け" },
];

export const DITHERING_GROUPS: {
  label: string;
  options: { value: DitheringType; label: string }[];
}[] = [
  { label: "なし", options: [{ value: "none", label: "使わない（くっきり）" }] },
  {
    label: "誤差拡散（なめらか）",
    options: [
      { value: "floyd-steinberg", label: "Floyd-Steinberg" },
      { value: "riemersma", label: "Riemersma" },
    ],
  },
  {
    label: "パターン（規則的なドット）",
    options: [
      { value: "ordered-2x2", label: "粗いドット 2×2" },
      { value: "ordered-4x4", label: "標準ドット 4×4" },
      { value: "ordered-8x8", label: "細かいドット 8×8" },
    ],
  },
  {
    label: "ドット密度（濃淡で表現）",
    options: [
      { value: "patterning-2x2", label: "密度 2×2" },
      { value: "patterning-4x4", label: "密度 4×4" },
      { value: "patterning-8x8", label: "密度 8×8" },
    ],
  },
];

export const OUTLINE_OPTIONS: { value: OutlineType; label: string }[] = [
  { value: "none", label: "なし" },
  { value: "soft", label: "やわらかい線" },
  { value: "auto", label: "はっきりした線" },
];

export const PIXEL_SIZES = [2, 4, 8, 12, 16] as const;
export const COLOR_COUNTS = [4, 8, 16, 32, 64] as const;

/** URLクエリ ⇔ パラメータ。共有リンクで設定ごと渡せるようにする */
const KEYS: Record<string, keyof ConversionParams> = {
  s: "style",
  p: "pixelSize",
  n: "numColors",
  pt: "paletteType",
  em: "extractMethod",
  d: "dithering",
  o: "outline",
  sa: "saturation",
  c: "enhanceContrast",
  sh: "removeShadow",
};

/**
 * 設定用のキーを1つでも含むクエリかどうか。
 * ?shared=1 や ?utm_source= のような無関係なクエリを
 * 「共有リンク」と誤認して保存済み設定を捨てないための判定。
 */
export function hasParamKeys(search: string): boolean {
  const q = new URLSearchParams(search);
  return Object.keys(KEYS).some((short) => q.has(short));
}

export function paramsToQuery(params: ConversionParams): string {
  const q = new URLSearchParams();
  for (const [short, key] of Object.entries(KEYS)) {
    const v = params[key];
    if (v === undefined || v === DEFAULT_PARAMS[key]) continue;
    q.set(short, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  }
  return q.toString();
}

/** 不正値は既定値にフォールバックする（エンジン側でも再度サニタイズされる） */
export function queryToParams(search: string): ConversionParams {
  const q = new URLSearchParams(search);
  const out: ConversionParams = { ...DEFAULT_PARAMS };

  const style = q.get("s");
  if (STYLE_OPTIONS.some((o) => o.value === style)) out.style = style as ConversionStyle;

  const pixelSize = Number(q.get("p"));
  if (PIXEL_SIZES.includes(pixelSize as (typeof PIXEL_SIZES)[number])) out.pixelSize = pixelSize;

  const numColors = Number(q.get("n"));
  if (COLOR_COUNTS.includes(numColors as (typeof COLOR_COUNTS)[number])) out.numColors = numColors;

  const paletteType = q.get("pt");
  if (PALETTE_OPTIONS.some((o) => o.value === paletteType))
    out.paletteType = paletteType as PaletteType;

  const extractMethod = q.get("em");
  if (EXTRACT_OPTIONS.some((o) => o.value === extractMethod))
    out.extractMethod = extractMethod as ExtractMethod;

  const dithering = q.get("d");
  if (DITHERING_GROUPS.some((g) => g.options.some((o) => o.value === dithering)))
    out.dithering = dithering as DitheringType;

  const outline = q.get("o");
  if (OUTLINE_OPTIONS.some((o) => o.value === outline)) out.outline = outline as OutlineType;

  const saturation = Number(q.get("sa"));
  if (Number.isFinite(saturation) && saturation >= 0 && saturation <= 200)
    out.saturation = saturation;

  if (q.get("c") === "1") out.enhanceContrast = true;
  if (q.get("sh") === "0") out.removeShadow = false;

  return out;
}

const STORE_KEY = "pc-params";

export function saveParams(params: ConversionParams): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(params));
  } catch {
    // 保存できなくても変換自体は動く
  }
}

export function loadParams(): ConversionParams | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    // 保存済みの値も信用せずクエリ経路と同じ検証をかける
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const q = new URLSearchParams();
    for (const [short, key] of Object.entries(KEYS)) {
      const v = parsed[key];
      if (v === undefined || v === null) continue;
      q.set(short, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
    }
    return queryToParams(q.toString());
  } catch {
    return null;
  }
}
