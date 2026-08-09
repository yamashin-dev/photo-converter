"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversionParams, ConversionProgress } from "@/engine/types";
import { startConversion, ConversionCancelledError } from "@/lib/converter";

/** 設定変更が続いている間は変換を走らせないための待ち時間 */
const DEBOUNCE_MS = 220;

export interface ConversionState {
  result: ImageData | null;
  progress: ConversionProgress | null;
  isConverting: boolean;
  error: string | null;
  /** 直近の変換にかかった時間（ms） */
  elapsedMs: number | null;
}

/**
 * 元画像とパラメータから変換結果を作る。
 * パラメータが変わるたびに自動で再変換し、走行中のものはキャンセルする
 * （旧版は設定変更のたびに画像を再アップロードしていた）。
 */
export function useConversion(source: ImageData | null, params: ConversionParams) {
  const [state, setState] = useState<ConversionState>({
    result: null,
    progress: null,
    isConverting: false,
    error: null,
    elapsedMs: null,
  });

  const handleRef = useRef<{ cancel: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    handleRef.current?.cancel();
    handleRef.current = null;
    runIdRef.current++;
    setState((s) => ({ ...s, isConverting: false, progress: null }));
  }, []);

  useEffect(() => {
    if (!source) return;

    const runId = ++runIdRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    handleRef.current?.cancel();

    // レンダー中ではなくイベント後の非同期文脈で更新する
    queueMicrotask(() =>
      setState((s) => ({ ...s, isConverting: true, error: null, progress: null }))
    );

    timerRef.current = setTimeout(() => {
      const startedAt = performance.now();
      const handle = startConversion(source, params, (progress) => {
        if (runId === runIdRef.current) setState((s) => ({ ...s, progress }));
      });
      handleRef.current = handle;

      handle.promise
        .then((result) => {
          if (runId !== runIdRef.current) return;
          setState({
            result,
            progress: null,
            isConverting: false,
            error: null,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
        })
        .catch((e: unknown) => {
          // 新しい変換に置き換わった場合の中断は通知しない
          if (runId !== runIdRef.current || e instanceof ConversionCancelledError) return;
          setState((s) => ({
            ...s,
            isConverting: false,
            progress: null,
            error: e instanceof Error ? e.message : "変換中にエラーが発生しました",
          }));
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [source, params]);

  // アンマウント時にWorkerを確実に停止する
  useEffect(() => () => handleRef.current?.cancel(), []);

  // 画像が無い間は前回の結果を見せない（状態を持たずに導出する）
  if (!source) {
    return {
      result: null,
      progress: null,
      isConverting: false,
      error: null,
      elapsedMs: null,
      cancel,
    };
  }

  return { ...state, cancel };
}
