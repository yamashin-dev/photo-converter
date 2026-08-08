/**
 * シード付き擬似乱数（mulberry32）。
 *
 * 旧実装は rand() を使っており同じ入力でも出力が毎回変わったため、
 * キャッシュ・回帰テスト・結果の再現が不可能だった。
 * エンジン内の乱数は必ずこれを使い、同じシード → 同じ出力を保証する。
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 0以上max以下の整数乱数（旧実装の rand(0, max) 相当） */
export function randInt(rng: Rng, max: number): number {
  return Math.floor(rng() * (max + 1));
}
