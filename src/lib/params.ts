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

/**
 * 手描き風スタイルの初期値。旧convert-photo-drawingのUI初期値に合わせている
 * （色数8・ディザなし・彩度100%・アウトラインなし・コントラスト強化なし）。
 * ここを変えると「前と印象が違う」という形で効いてくるので、
 * 変更するときは旧版の見た目と比べてから決めること。
 */
export const ILLUSTRATION_DEFAULTS: Partial<ConversionParams> = {
  numColors: 8,
  paletteType: "auto",
  extractMethod: "kmeans",
  outline: "none",
  saturation: 100,
};

export const STYLE_OPTIONS: { value: ConversionStyle; label: string; hint: string }[] = [
  { value: "pixel-retro", label: "ドット絵", hint: "16bit機のようなレトロなピクセルアート" },
  { value: "pixel-integer", label: "ドット絵（くっきり）", hint: "ドットの境界が完全に揃う整数倍出力" },
  { value: "illustration", label: "手描き風", hint: "影を飛ばした柔らかいイラスト調" },
];

/**
 * 色づかいの選択肢。
 * 内部の値（famicom / gameboy）は旧実装からの互換のため据え置き、
 * 表示名だけ一般名詞にしている。特定の商品名は商標にあたるため使わない。
 */
export const PALETTE_OPTIONS: { value: PaletteType; label: string }[] = [
  { value: "auto", label: "写真から自動抽出" },
  { value: "famicom", label: "8bit家庭用機風" },
  { value: "gameboy", label: "携帯ゲーム機風（緑）" },
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

/**
 * ひと押しで仕上がりが決まる入口。
 *
 * スタイル3種 × ドット5段階 × 色数5段階 × ディザ9種 × パレット9種 と
 * 組み合わせが多すぎて、初めての人は選びようがない。
 * まずここから選んでもらい、細かい調整は「こだわる」に譲る。
 */
export interface Preset {
  id: string;
  label: string;
  hint: string;
  params: Partial<ConversionParams>;
}

export const PRESETS: Preset[] = [
  {
    id: "retro-game",
    label: "レトロゲーム",
    hint: "粗いドットと16色。8bit機のような画面に",
    params: {
      style: "pixel-retro",
      pixelSize: 8,
      numColors: 16,
      paletteType: "auto",
      extractMethod: "mediancut",
      dithering: "ordered-4x4",
      outline: "none",
      saturation: 115,
    },
  },
  {
    id: "fine-dot",
    label: "細かいドット",
    hint: "被写体が分かる細かさ。SNSのアイコン向き",
    params: {
      style: "pixel-retro",
      pixelSize: 4,
      numColors: 32,
      paletteType: "auto",
      extractMethod: "mediancut",
      dithering: "floyd-steinberg",
      outline: "none",
      saturation: 100,
    },
  },
  {
    id: "handheld-green",
    label: "携帯ゲーム機",
    hint: "緑一色の懐かしい画面",
    params: {
      style: "pixel-retro",
      pixelSize: 8,
      numColors: 16,
      paletteType: "gameboy",
      dithering: "ordered-2x2",
      outline: "none",
      saturation: 100,
    },
  },
  {
    id: "illustration",
    label: "手描き風",
    hint: "影を飛ばした、やわらかいイラスト調",
    params: {
      style: "illustration",
      pixelSize: 4,
      numColors: 8,
      paletteType: "auto",
      extractMethod: "kmeans",
      dithering: "none",
      outline: "none",
      saturation: 100,
      removeShadow: true,
    },
  },
  {
    id: "anime-line",
    label: "線画つき",
    hint: "輪郭線を足して、アニメ調に近づける",
    params: {
      style: "illustration",
      pixelSize: 4,
      numColors: 12,
      paletteType: "auto",
      extractMethod: "kmeans",
      dithering: "none",
      outline: "soft",
      saturation: 110,
      removeShadow: true,
      enhanceContrast: true,
    },
  },
  {
    id: "monochrome",
    label: "モノクロ",
    hint: "新聞の写真のような点描",
    params: {
      style: "pixel-retro",
      pixelSize: 4,
      numColors: 16,
      paletteType: "grayscale",
      dithering: "patterning-4x4",
      outline: "none",
      saturation: 100,
    },
  },
  {
    id: "sunset",
    label: "夕焼け",
    hint: "紫からオレンジへ。夕暮れの色に染める",
    params: {
      style: "pixel-integer",
      pixelSize: 8,
      numColors: 16,
      paletteType: "sunset",
      dithering: "ordered-4x4",
      outline: "none",
      saturation: 100,
    },
  },
];

/** いま選ばれている設定に一致するプリセットを探す（無ければnull） */
export function matchPreset(params: ConversionParams): string | null {
  for (const preset of PRESETS) {
    const same = Object.entries(preset.params).every(
      ([key, value]) => params[key as keyof ConversionParams] === value
    );
    if (same) return preset.id;
  }
  return null;
}

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
