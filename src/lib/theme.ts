"use client";

/**
 * テーマの外部ストア。
 * 真実の置き場は <html data-theme>（ThemeScriptが初回ペイント前に設定する）で、
 * Reactはそれを購読するだけにする。
 */

export type Theme = "light" | "dark";

const KEY = "pc-theme";
const listeners = new Set<() => void>();

let snapshot: Theme = "light";

function emit() {
  listeners.forEach((fn) => fn());
}

export function subscribeTheme(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getThemeSnapshot(): Theme {
  if (typeof document !== "undefined") {
    const applied = document.documentElement.dataset.theme;
    if (applied === "light" || applied === "dark") snapshot = applied;
  }
  return snapshot;
}

/** SSR/静的生成時の値。実際の適用はThemeScriptが行う */
export function getThemeServerSnapshot(): Theme {
  return "light";
}

export function toggleTheme(): void {
  const next: Theme = getThemeSnapshot() === "dark" ? "light" : "dark";
  snapshot = next;
  document.documentElement.dataset.theme = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // 保存できなくてもその場の切り替えは効く
  }
  emit();
}
