"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./DropZone.module.css";
import { IconUpload } from "./Icon";
import { ACCEPTED_TYPES } from "@/lib/imageLoader";

/** 変化しない値を読むだけなので購読は不要 */
const subscribeNoop = () => () => {};

export function DropZone({
  onFile,
  onSample,
  disabled,
}: {
  onFile: (file: File) => void;
  /** 写真を持っていない人向けの導線。省略するとボタンは出ない */
  onSample?: () => void;
  disabled?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  // 静的HTMLにはビルドマシンの環境が焼き込まれてしまうため、
  // 端末依存の表記はhydration後に差し替える（既定はWindows/Linux表記）
  const modifier = useSyncExternalStore(
    subscribeNoop,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"),
    () => "Ctrl"
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) onFile(file);
    },
    [onFile]
  );

  // クリップボードから直接貼り付けられるようにする（旧版にはない導線）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (disabled) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/")
      );
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        onFile(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onFile, disabled]);

  return (
    <div
      className={`${styles.zone} ${dragging ? styles.dragging : ""}`}
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current++;
        setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        // 子要素をまたぐ度に発火するため深さで判定する
        dragDepth.current--;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
    >
      {/*
        opacity:0 では要素はフォーカス可能なまま残る。
        名前のない不可視要素にタブが止まらないよう明示的に外す
      */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className={styles.input}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          handleFiles(e.target.files);
          // 同じファイルを選び直せるようにする
          e.target.value = "";
        }}
        disabled={disabled}
      />

      <div className={styles.inner}>
        <span className={styles.mark} aria-hidden="true">
          <IconUpload size={26} />
        </span>
        <h2 className={styles.title}>写真を選ぶ</h2>
        <p className={styles.lead}>
          ここにドラッグ＆ドロップ、貼り付け（{modifier}+V）、
          <br className={styles.brOnlyWide} />
          またはボタンから選択できます。
        </p>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            ファイルを選ぶ
          </button>
          {onSample && (
            <button
              type="button"
              className={styles.sampleButton}
              onClick={onSample}
              disabled={disabled}
            >
              サンプル写真で試す
            </button>
          )}
        </div>
        <p className={styles.note}>
          JPEG / PNG / GIF / WebP / HEIC 対応。
          <strong className={styles.strong}>画像はこの端末から送信されません。</strong>
        </p>
      </div>
    </div>
  );
}
