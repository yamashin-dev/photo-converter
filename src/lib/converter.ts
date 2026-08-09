import type { ConversionParams, ConversionProgress } from "@/engine/types";
import type { ConvertRequest, ConvertResponse } from "@/engine/worker";

/**
 * 変換Workerのメインスレッド側ラッパー。
 * - 実進捗の通知（旧版の偽プログレスバーの置き換え）
 * - cancel() による即時キャンセル
 *
 * Workerは一度作ったら使い回す。変換のたびに作り直していたときは、
 * 起動とモジュール読み込みだけで数秒かかっていた（実測で下書きが4.7秒）。
 *
 * ImageData はブラウザ環境でのみ存在するため、このモジュールはUI層専用。
 * エンジン本体（src/engine/）はNode上のテストでも動く。
 */

/** キャンセルによる中断。UI側は instanceof でエラー表示をスキップできる */
export class ConversionCancelledError extends Error {
  constructor() {
    super("変換はキャンセルされました");
    this.name = "ConversionCancelledError";
  }
}

export interface ConversionHandle {
  promise: Promise<ImageData>;
  cancel: () => void;
}

let worker: Worker | null = null;
let nextRequestId = 1;

function getWorker(): Worker {
  if (!worker) {
    // worker.ts はESモジュール（import使用）のため type: "module" が必須。
    // 指定がないとバンドラの出力形態によってはclassic workerとしてロードされ
    // 「Cannot use import statement outside a module」で全変換が失敗する
    worker = new Worker(new URL("../engine/worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

/**
 * Workerを先に起こしておく。
 * 最初の変換でモジュール読み込みを待たせないための準備で、呼ばなくても動く。
 */
export function warmUpConverter(): void {
  if (typeof window === "undefined") return;
  getWorker();
}

export function startConversion(
  source: ImageData,
  params: ConversionParams,
  onProgress?: (progress: ConversionProgress) => void
): ConversionHandle {
  const w = getWorker();
  const requestId = nextRequestId++;
  let settled = false;
  let rejectFn: ((reason: Error) => void) | null = null;
  let cleanup = () => {};

  const promise = new Promise<ImageData>((resolve, reject) => {
    rejectFn = reject;

    const onMessage = (event: MessageEvent<ConvertResponse>) => {
      const msg = event.data;
      // 捨てた依頼の結果が届くことがあるので、必ず照合する
      if (msg.requestId !== requestId) return;

      if (msg.type === "progress") {
        onProgress?.(msg.progress);
        return;
      }
      settled = true;
      cleanup();
      if (msg.type === "done") {
        resolve(new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height));
      } else {
        reject(new Error(msg.message));
      }
    };

    const onError = (event: ErrorEvent) => {
      settled = true;
      cleanup();
      reject(new Error(event.message || "変換Workerでエラーが発生しました"));
    };

    cleanup = () => {
      w.removeEventListener("message", onMessage);
      w.removeEventListener("error", onError);
    };

    w.addEventListener("message", onMessage);
    w.addEventListener("error", onError);

    // 元データはUI側で再利用する（比較スライダー表示等）ためコピーを転送する
    const buffer = source.data.slice().buffer;
    const request: ConvertRequest = {
      type: "convert",
      requestId,
      width: source.width,
      height: source.height,
      buffer,
      params,
    };
    w.postMessage(request, [buffer]);
  });

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      cleanup();
      // 変換中のループは外から止められないため、Workerごと捨てる。
      // 次の変換を待たせないよう、すぐ新しいものを起こしておく
      w.terminate();
      if (worker === w) worker = null;
      getWorker();
      rejectFn?.(new ConversionCancelledError());
    },
  };
}
