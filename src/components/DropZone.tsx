"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import styles from "./DropZone.module.css";
import { IconUpload } from "./Icon";
import { ACCEPTED_TYPES } from "@/lib/imageLoader";

/** 変化しない値を読むだけなので購読は不要 */
const subscribeNoop = () => () => {};

export function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
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
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className={styles.input}
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
        <button
          type="button"
          className={styles.button}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
        >
          ファイルを選ぶ
        </button>
        <p className={styles.note}>
          JPEG / PNG / GIF / WebP / HEIC 対応。
          <strong className={styles.strong}>画像はこの端末から送信されません。</strong>
        </p>
      </div>
    </div>
  );
}
