"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SITE } from "@/lib/site";
import {
  getConsentServerSnapshot,
  getConsentSnapshot,
  subscribeConsent,
} from "@/lib/consent";

/**
 * GA4タグ。同意が「granted」のときだけスクリプトを注入する。
 * 測定IDが未設定のビルド（開発・プレビュー）では何も読み込まない。
 */
export function Analytics() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot
  );

  useEffect(() => {
    if (!SITE.gaId || consent !== "granted") return;
    if (document.getElementById("ga4-src")) return;

    const s = document.createElement("script");
    s.id = "ga4-src";
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${SITE.gaId}`;
    document.head.appendChild(s);

    const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
    w.dataLayer = w.dataLayer || [];
    w.gtag = function gtag(...args: unknown[]) {
      w.dataLayer!.push(args);
    };
    w.gtag("js", new Date());
    w.gtag("config", SITE.gaId, { anonymize_ip: true });
  }, [consent]);

  return null;
}

/** 変換完了などの任意イベント送信（同意前・未設定時は何もしない） */
export function trackEvent(name: string, params?: Record<string, string | number | boolean>) {
  const w = window as unknown as { gtag?: (...a: unknown[]) => void };
  if (!SITE.gaId || !w.gtag) return;
  w.gtag("event", name, params ?? {});
}
