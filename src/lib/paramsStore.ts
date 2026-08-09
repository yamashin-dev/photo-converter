"use client";

import type { ConversionParams } from "@/engine/types";
import { DEFAULT_PARAMS, loadParams, queryToParams, saveParams } from "./params";

/**
 * 変換パラメータの外部ストア。
 *
 * 初期値は「共有URLのクエリ > 前回保存した設定 > 既定値」の優先順で決まるが、
 * どちらもブラウザにしか存在しないため、Reactのeffectで後から流し込むと
 * 余計な再レンダリングが起きる。ここで購読可能なストアにしておき、
 * useSyncExternalStore から読む。
 */

const listeners = new Set<() => void>();

let snapshot: ConversionParams = DEFAULT_PARAMS;
let hydrated = false;

export function subscribeParams(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getParamsSnapshot(): ConversionParams {
  if (!hydrated && typeof window !== "undefined") {
    const search = window.location.search;
    snapshot = search.length > 1 ? queryToParams(search) : (loadParams() ?? DEFAULT_PARAMS);
    hydrated = true;
  }
  return snapshot;
}

/** SSR/静的生成時は既定値（同一参照を返す必要がある） */
export function getParamsServerSnapshot(): ConversionParams {
  return DEFAULT_PARAMS;
}

export function updateParams(
  update: (prev: ConversionParams) => ConversionParams
): void {
  const next = update(getParamsSnapshot());
  snapshot = next;
  hydrated = true;
  saveParams(next);
  listeners.forEach((fn) => fn());
}
