"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./ZoomView.module.css";
import { IconClose } from "./Icon";

const LEVELS = [1, 2, 4, 8] as const;

/**
 * 変換結果を等倍〜8倍で確かめるための表示。
 *
 * ドット絵は縮小表示だと粒の出方が分からず、品質を判断できない。
 * 旧版にあった拡大表示が新版で失われていたため復活させたもの。
 */
export function ZoomView({
  url,
  pixelated,
  onClose,
}: {
  url: string;
  pixelated: boolean;
  onClose: () => void;
}) {
  const [level, setLevel] = useState<number>(2);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // 開いたら閉じるボタンへ移し、Escapeで戻れるようにする
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 背面のページが動くと戻る位置を見失うので止めておく
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 開いている間はフォーカスを内側に留める
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="変換結果を拡大して表示"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className={styles.bar}>
          <div className={styles.levels} role="group" aria-label="拡大率">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                className={`${styles.level} ${level === l ? styles.levelOn : ""}`}
                onClick={() => setLevel(l)}
                aria-pressed={level === l}
              >
                {l}倍
              </button>
            ))}
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose}>
            <IconClose size={18} />
            閉じる
          </button>
        </div>

        <div className={styles.scroller} ref={scrollerRef}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="変換結果の拡大表示"
            className={pixelated ? styles.pixelated : undefined}
            style={{ width: `${level * 100}%` }}
          />
        </div>

        <p className={styles.note}>
          ドラッグでスクロールできます。Escapeキーでも閉じられます。
        </p>
      </div>
    </div>
  );
}
