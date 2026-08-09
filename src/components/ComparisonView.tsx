"use client";

import { useState } from "react";
import styles from "./ComparisonView.module.css";
import type { ConversionProgress } from "@/engine/types";
import { IconGrid } from "./Icon";

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
 * 元画像と変換結果の比較表示。
 * clip-pathで上に重ねた変換結果を切り出し、スライダーで境界を動かす。
 */
export function ComparisonView({
  originalUrl,
  resultUrl,
  isConverting,
  progress,
  onCancel,
  pixelated,
}: {
  originalUrl: string;
  resultUrl: string | null;
  isConverting: boolean;
  progress: ConversionProgress | null;
  onCancel: () => void;
  pixelated: boolean;
}) {
  // 画像が差し替わったときの初期化は、呼び出し側が key を変えて行う
  const [split, setSplit] = useState(50);
  const [showGrid, setShowGrid] = useState(false);

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

        {isConverting && (
          <div className={styles.progressLayer}>
            <div className={styles.progressBox}>
              <p className={styles.stage}>
                {progress ? STAGE_LABEL[progress.stage] : "準備中"}
              </p>
              {/* 実測値で伸びるバー（旧版はタイマーで動くだけの偽装だった） */}
              <div
                className={styles.track}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((progress?.ratio ?? 0) * 100)}
              >
                <div
                  className={styles.bar}
                  style={{ width: `${Math.round((progress?.ratio ?? 0) * 100)}%` }}
                />
              </div>
              <button type="button" className={styles.cancel} onClick={onCancel}>
                中止する
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
        <span className={styles.hint}>スライダーで変換前後を見比べられます</span>
      </div>
    </div>
  );
}
