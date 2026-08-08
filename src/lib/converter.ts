import type { ConversionParams, ConversionProgress } from "@/engine/types";
import type { ConvertRequest, ConvertResponse } from "@/engine/worker";

/**
 * 変換Workerのメインスレッド側ラッパー。
 * - 実進捗の通知（旧版の偽プログレスバーの置き換え）
 * - cancel() による即時キャンセル（worker.terminate + promise reject）
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

export function startConversion(
  source: ImageData,
  params: ConversionParams,
  onProgress?: (progress: ConversionProgress) => void
): ConversionHandle {
  // worker.ts はESモジュール（import使用）のため type: "module" が必須。
  // 指定がないとバンドラの出力形態によってはclassic workerとしてロードされ
  // 「Cannot use import statement outside a module」で全変換が失敗する
  const worker = new Worker(new URL("../engine/worker.ts", import.meta.url), {
    type: "module",
  });
  let settled = false;
  let rejectFn: ((reason: Error) => void) | null = null;

  const promise = new Promise<ImageData>((resolve, reject) => {
    rejectFn = reject;
    worker.onmessage = (event: MessageEvent<ConvertResponse>) => {
      const msg = event.data;
      if (msg.type === "progress") {
        onProgress?.(msg.progress);
      } else if (msg.type === "done") {
        settled = true;
        worker.terminate();
        resolve(new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height));
      } else {
        settled = true;
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = (event) => {
      settled = true;
      worker.terminate();
      reject(new Error(event.message || "変換Workerでエラーが発生しました"));
    };

    // 元データはUI側で再利用する（比較スライダー表示等）ためコピーを転送する
    const buffer = source.data.slice().buffer;
    const request: ConvertRequest = {
      type: "convert",
      width: source.width,
      height: source.height,
      buffer,
      params,
    };
    worker.postMessage(request, [buffer]);
  });

  return {
    promise,
    cancel: () => {
      if (!settled) {
        settled = true;
        worker.terminate();
        rejectFn?.(new ConversionCancelledError());
      }
    },
  };
}
