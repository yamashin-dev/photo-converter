"use client";

import { useState } from "react";
import styles from "./ComparisonView.module.css";
import type { ConversionProgress } from "@/engine/types";
import { IconGrid, IconZoom } from "./Icon";
import { ZoomView } from "./ZoomView";

const STAGE_LABEL: Record<ConversionProgress["stage"], string> = {
  decode: "画像を読み込み中",
  preprocess: "下ごしらえ中",
  downscale: "ドットに落とし込み中",
  palette: "色を選び出し中",
  quantize: "色を置き換え中",
  saturate: "色味を調整中",
  outline: "輪郭を描き込み中",
  dithering: "ディザをかけ中",
  upscale: "仕上げ中",
  encode: "書き出し中",
};

/**
 * プレビューが今どの状態にあるか。
 * 「変換中でない かつ 結果がない」を一括で中止扱いにすると、
 * 変換成功直後（書き出し待ち）やエラー時まで「中止しました」と出てしまうため、
 * 呼び出し側で状態を判定して渡す。
 */
export type PreviewState =
  | "converting" // 変換中（まだ何も出せない）
  | "refining" // 下書きを見せながら、裏で本番の品質を作っている
  | "encoding" // 変換は終わり、表示用画像を書き出し中
  | "ready" // 表示できる
  | "cancelled" // 利用者が中止した
  | "error"; // 変換に失敗した

/**
 * 元画像と変換結果の比較表示。
 * clip-pathで上に重ねた変換結果を切り出し、スライダーで境界を動かす。
 */
export function ComparisonView({
  originalUrl,
  resultUrl,
  state,
  errorMessage,
  progress,
  onCancel,
  onRetry,
  pixelated,
}: {
  originalUrl: string;
  resultUrl: string | null;
  state: PreviewState;
  errorMessage: string | null;
  progress: ConversionProgress | null;
  onCancel: () => void;
  onRetry: () => void;
  pixelated: boolean;
}) {
  // 画像が差し替わったときの初期化は、呼び出し側が key を変えて行う
  const [split, setSplit] = useState(50);
  const [showGrid, setShowGrid] = useState(false);
  const [zoomOpen, setZoomOpen] = useState(false);
  const percent = Math.round((progress?.ratio ?? 0) * 100);

  return (
    <div className={styles.wrap}>
      <div className={styles.frame}>
        {/* Blob URLのため next/image の最適化対象にできない */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={originalUrl} alt="変換前の写真" className={styles.base} />

        {resultUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resultUrl}
            alt="変換後の画像"
            className={`${styles.overlay} ${pixelated ? styles.pixelated : ""}`}
            style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
          />
        )}

        {showGrid && <div className={styles.grid} aria-hidden="true" />}

        {resultUrl && (
          <>
            <div className={styles.divider} style={{ left: `${split}%` }} aria-hidden="true">
              <span className={styles.handle} />
            </div>
            <label className={styles.sliderLabel}>
              <span className="srOnly">変換前と変換後の表示比率</span>
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                className={styles.slider}
                aria-valuetext={`変換後を${split}%表示`}
              />
            </label>
            <span className={`${styles.tag} ${styles.tagLeft}`}>変換後</span>
            <span className={`${styles.tag} ${styles.tagRight}`}>元の写真</span>
          </>
        )}

        {state === "converting" && (
          <div className={styles.progressLayer}>
            <div className={styles.progressBox}>
              <p className={styles.stage}>
                {progress ? STAGE_LABEL[progress.stage] : "準備中"}
              </p>
              {/* 実測値で伸びるバー（旧版はタイマーで動くだけの偽装だった） */}
              <div
                className={styles.track}
                role="progressbar"
                aria-label="変換の進捗"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-valuetext={`${progress ? STAGE_LABEL[progress.stage] : "準備中"} ${percent}%`}
              >
                <div className={styles.bar} style={{ width: `${percent}%` }} />
              </div>
              <button type="button" className={styles.cancel} onClick={onCancel}>
                中止する
              </button>
            </div>
          </div>
        )}

        {/* 下書きは見えているので画面は塞がず、隅で仕上げ中とだけ伝える */}
        {state === "refining" && (
          <p className={styles.refining} role="status">
            <span className={styles.refiningDot} aria-hidden="true" />
            仕上げ中
          </p>
        )}

        {/* 変換は終わっているので、失敗と誤解させない文言にする */}
        {state === "encoding" && (
          <div className={styles.progressLayer}>
            <div className={styles.progressBox}>
              <p className={styles.stage}>プレビューを準備しています</p>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className={styles.progressLayer}>
            <div className={styles.progressBox}>
              <p className={styles.stage}>変換できませんでした</p>
              {errorMessage && <p className={styles.detail}>{errorMessage}</p>}
              <button type="button" className={styles.retry} onClick={onRetry}>
                もう一度試す
              </button>
            </div>
          </div>
        )}

        {/* 中止したままだと何も出せないので、やり直す導線を残す */}
        {state === "cancelled" && (
          <div className={styles.progressLayer}>
            <div className={styles.progressBox}>
              <p className={styles.stage}>変換を中止しました</p>
              <button type="button" className={styles.retry} onClick={onRetry}>
                もう一度変換する
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.tools}>
        <button
          type="button"
          className={`${styles.toolBtn} ${showGrid ? styles.toolBtnOn : ""}`}
          onClick={() => setShowGrid((v) => !v)}
          aria-pressed={showGrid}
        >
          <IconGrid size={16} />
          グリッド
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setZoomOpen(true)}
          disabled={!resultUrl}
        >
          <IconZoom size={16} />
          拡大して見る
        </button>
        <span className={styles.hint}>スライダーで変換前後を見比べられます</span>
      </div>

      {zoomOpen && resultUrl && (
        <ZoomView url={resultUrl} pixelated={pixelated} onClose={() => setZoomOpen(false)} />
      )}
    </div>
  );
}
