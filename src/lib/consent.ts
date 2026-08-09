"use client";

/**
 * アクセス解析（GA4）のCookie同意状態を保持する外部ストア。
 * 同意が得られるまで計測タグ自体を読み込まない（事前同意方式）。
 */

export type ConsentState = "granted" | "denied" | "unset";

const KEY = "pc-consent";
const listeners = new Set<() => void>();

let snapshot: ConsentState = "unset";
let hydrated = false;

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeConsent(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getConsentSnapshot(): ConsentState {
  if (!hydrated && typeof window !== "undefined") {
    try {
      const v = localStorage.getItem(KEY);
      snapshot = v === "granted" || v === "denied" ? v : "unset";
    } catch {
      snapshot = "unset";
    }
    hydrated = true;
  }
  return snapshot;
}

/** SSR/静的生成時は未決定として扱う（バナーはhydration後に出す） */
export function getConsentServerSnapshot(): ConsentState {
  return "unset";
}

export function setConsent(state: Exclude<ConsentState, "unset">): void {
  snapshot = state;
  hydrated = true;
  try {
    localStorage.setItem(KEY, state);
  } catch {
    // プライベートブラウジング等で保存できなくても動作は継続する
  }
  emit();
}
