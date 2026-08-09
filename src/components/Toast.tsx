"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

export type ToastKind = "info" | "success" | "error";

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((list) => [...list, { id, kind, message }]);
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

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const ms = item.kind === "error" ? 6000 : 3200;
    const timer = setTimeout(() => onDismiss(item.id), ms);
    return () => clearTimeout(timer);
  }, [item, onDismiss]);

  return (
    <div className={`${styles.toast} ${styles[item.kind]}`}>
      {/* サーバー由来の文字列も含むためテキストノードとして描画する */}
      <span>{item.message}</span>
      <button className={styles.close} onClick={() => onDismiss(item.id)} aria-label="閉じる">
        ×
      </button>
    </div>
  );
}
