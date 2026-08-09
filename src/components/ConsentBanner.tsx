"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import styles from "./ConsentBanner.module.css";
import {
  getConsentServerSnapshot,
  getConsentSnapshot,
  setConsent,
  subscribeConsent,
} from "@/lib/consent";
import { SITE } from "@/lib/site";

/**
 * アクセス解析Cookieの同意バナー。
 * 同意・拒否は対等な見た目にし、拒否を選びにくくする表現は使わない。
 */
export function ConsentBanner() {
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getConsentServerSnapshot
  );

  if (!SITE.gaId || consent !== "unset") return null;

  const decide = (state: "granted" | "denied") => setConsent(state);

  return (
    <div className={styles.banner} role="dialog" aria-label="アクセス解析についての確認">
      <p className={styles.text}>
        サイトの改善のため、アクセス解析（Google
        アナリティクス）を使わせていただけますか。変換した画像や写真そのものは送信されません。
        <Link href="/privacy" className={styles.link}>
          プライバシーポリシー
        </Link>
      </p>
      <div className={styles.actions}>
        <button type="button" className={styles.btn} onClick={() => decide("denied")}>
          使わない
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.primary}`}
          onClick={() => decide("granted")}
        >
          許可する
        </button>
      </div>
    </div>
  );
}
