"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversionParams, ConversionProgress } from "@/engine/types";
import { startConversion, ConversionCancelledError } from "@/lib/converter";

/** 設定変更が続いている間は変換を走らせないための待ち時間 */
const DEBOUNCE_MS = 220;

/**
 * 下書きプレビューの解像度（長辺px）。
 *
 * 手描き風は前処理が重く、1600pxでも実測で10秒近くかかる。
 * まず粗く作って見せ、続けて本来の品質へ差し替える。
 * 720pxでは下書き自体に2.6秒かかったため、雰囲気が分かる最小限まで落としている。
 */
const DRAFT_MAX_DIMENSION = 480;

/** 元画像がこの倍率より大きいときだけ下書きを挟む（小さい画像は一発で十分速い） */
const DRAFT_THRESHOLD = 1.6;

export interface ConversionState {
  result: ImageData | null;
  /** その結果がどの入力から作られたか。古い結果を表示しないための照合用 */
  resultSource: ImageData | null;
  progress: ConversionProgress | null;
  isConverting: boolean;
  /** 表示中の結果が下書き（粗い先出し）かどうか */
  isDraft: boolean;
  error: string | null;
  /** 直近の変換にかかった時間（ms） */
  elapsedMs: number | null;
}

const EMPTY: ConversionState = {
  result: null,
  resultSource: null,
  progress: null,
  isConverting: false,
  isDraft: false,
  error: null,
  elapsedMs: null,
};

/**
 * 元画像とパラメータから変換結果を作る。
 * パラメータが変わるたびに自動で再変換し、走行中のものはキャンセルする
 * （旧版は設定変更のたびに画像を再アップロードしていた）。
 */
export function useConversion(source: ImageData | null, params: ConversionParams) {
  const [state, setState] = useState<ConversionState>(EMPTY);

  const handleRef = useRef<{ cancel: () => void } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);
  /** 中止後に同じ設定でもう一度走らせるためのトリガー */
  const [retryToken, setRetryToken] = useState(0);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    handleRef.current?.cancel();
    handleRef.current = null;
    runIdRef.current++;
    setState((s) => ({ ...s, isConverting: false, progress: null }));
  }, []);

  /** 中止したあと、同じ設定のままやり直す */
  const retry = useCallback(() => setRetryToken((t) => t + 1), []);

  useEffect(() => {
    if (!source) return;

    const runId = ++runIdRef.current;
    if (timerRef.current) clearTimeout(timerRef.current);
    handleRef.current?.cancel();

    // レンダー中ではなくイベント後の非同期文脈で更新する
    queueMicrotask(() =>
      setState((s) => ({ ...s, isConverting: true, error: null, progress: null }))
    );

    timerRef.current = setTimeout(async () => {
      const startedAt = performance.now();
      const longSide = Math.max(source.width, source.height);
      const isCurrent = () => runId === runIdRef.current;

      // 1. 下書き: 縮小して素早く作り、待ち時間を体感させない。
      //    ドットの粗さは元画像に対する比率なので、縮小率に合わせて縮める
      if (longSide > DRAFT_MAX_DIMENSION * DRAFT_THRESHOLD) {
        const scale = DRAFT_MAX_DIMENSION / longSide;
        const draftHandle = startConversion(source, {
          ...params,
          maxDimension: DRAFT_MAX_DIMENSION,
          pixelSize: Math.max(2, Math.round(params.pixelSize * scale)),
        });
        handleRef.current = draftHandle;
        try {
          const draft = await draftHandle.promise;
          if (!isCurrent()) return;
          setState((s) => ({
            ...s,
            result: draft,
            resultSource: source,
            isDraft: true,
            isConverting: true,
            error: null,
          }));
        } catch {
          // 下書きに失敗しても本番の変換は試す
          if (!isCurrent()) return;
        }
      }

      // 2. 本番: 元の解像度で仕上げる
      const handle = startConversion(source, params, (progress) => {
        if (isCurrent()) setState((s) => ({ ...s, progress }));
      });
      handleRef.current = handle;

      handle.promise
        .then((result) => {
          if (!isCurrent()) return;
          setState({
            result,
            resultSource: source,
            progress: null,
            isConverting: false,
            isDraft: false,
            error: null,
            elapsedMs: Math.round(performance.now() - startedAt),
          });
        })
        .catch((e: unknown) => {
          // 新しい変換に置き換わった場合の中断は通知しない
          if (!isCurrent() || e instanceof ConversionCancelledError) return;
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
  }, [source, params, retryToken]);

  // アンマウント時にWorkerを確実に停止する
  useEffect(() => () => handleRef.current?.cancel(), []);

  // 画像が無い / 別の画像に切り替わった直後は、前の結果を見せない。
  // 「どの入力の結果か」で照合するので、状態を消して回る必要がない
  const isStale = !source || state.resultSource !== source;
  if (isStale) {
    return {
      ...EMPTY,
      isConverting: state.isConverting && !!source,
      progress: state.progress,
      error: state.error,
      cancel,
      retry,
    };
  }

  return { ...state, cancel, retry };
}
