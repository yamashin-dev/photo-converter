import type { ConversionParams, ConversionProgress } from "./types";
import type { ImageBuffer } from "./image";
import { convertPixelArt } from "./styles/pixelArt";
import { convertIllustration } from "./styles/illustration";

/**
 * Web Workerエントリポイント。
 * メインスレッドをブロックせずに変換を実行し、実進捗を通知する。
 *
 * キャンセルはメインスレッド側で worker.terminate() によって行う
 * （変換は同期処理のため、メッセージによる協調キャンセルはできない）。
 * ラッパー実装は src/lib/converter.ts を参照。
 */

/** メインスレッド → Worker */
export interface ConvertRequest {
  type: "convert";
  /** 転送可能にするため width/height/buffer で受け渡す */
  width: number;
  height: number;
  /** RGBA。Transferable として move される */
  buffer: ArrayBuffer;
  params: ConversionParams;
}

/** Worker → メインスレッド */
export type ConvertResponse =
  | { type: "progress"; progress: ConversionProgress }
  | { type: "done"; width: number; height: number; buffer: ArrayBuffer }
  | { type: "error"; message: string };

function toImageBuffer(req: ConvertRequest): ImageBuffer {
  return {
    width: req.width,
    height: req.height,
    data: new Uint8ClampedArray(req.buffer),
  };
}

self.onmessage = (event: MessageEvent<ConvertRequest>) => {
  const req = event.data;
  if (req.type !== "convert") return;

  const post = (msg: ConvertResponse, transfer?: Transferable[]) => {
    (self as unknown as Worker).postMessage(msg, transfer ?? []);
  };

  try {
    const src = toImageBuffer(req);
    const convert =
      req.params.style === "illustration" ? convertIllustration : convertPixelArt;
    const result = convert(src, req.params, (progress) => {
      post({ type: "progress", progress });
    });
    // createImageで生成したバッファは常に通常のArrayBuffer（SharedArrayBufferではない）
    const buffer = result.data.buffer as ArrayBuffer;
    post({ type: "done", width: result.width, height: result.height, buffer }, [buffer]);
  } catch (e) {
    post({ type: "error", message: e instanceof Error ? e.message : String(e) });
  }
};
