"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

export type ToastKind = "info" | "success" | "error";

export interface ToastAction {
  label: string;
  onAct: () => void;
}

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  /** 取り消しなど、その場でやり直せる操作 */
  action?: ToastAction;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string, action?: ToastAction) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message, action }]);
    return id;
  }, []);

  return { toasts, push, dismiss };
}

export function ToastList({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    // 支援技術にも読み上げられるようにライブリージョンにする（旧版は未対応）
    <div className={styles.stack} role="status" aria-live="polite">
      {toasts.map((t) => (
        <Toast key={t.id} item={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const KIND_LABEL: Record<ToastKind, string> = {
  info: "お知らせ",
  success: "完了",
  error: "エラー",
};

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  // 読んでいる途中・操作しようとしている途中で消えないよう、触れている間は止める
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    // エラーは読み切れないことがあるので長め。操作つきはさらに猶予を持たせる
    const ms = item.action ? 8000 : item.kind === "error" ? 7000 : 3600;
    const timer = setTimeout(() => onDismiss(item.id), ms);
    return () => clearTimeout(timer);
  }, [item, onDismiss, paused]);

  return (
    <div
      className={`${styles.toast} ${styles[item.kind]}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {/* サーバー由来の文字列も含むためテキストノードとして描画する */}
      <span className={styles.body}>
        {/* 種別を色だけで伝えない */}
        <span className="srOnly">{KIND_LABEL[item.kind]}: </span>
        {item.message}
      </span>
      {item.action && (
        <button
          className={styles.action}
          onClick={() => {
            item.action!.onAct();
            onDismiss(item.id);
          }}
        >
          {item.action.label}
        </button>
      )}
      <button className={styles.close} onClick={() => onDismiss(item.id)} aria-label="閉じる">
        ×
      </button>
    </div>
  );
}
