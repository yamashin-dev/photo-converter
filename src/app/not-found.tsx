import type { Metadata } from "next";
import Link from "next/link";
import styles from "./not-found.module.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "ページが見つかりません",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <p className={styles.code} aria-hidden="true">
          404
        </p>
        <h1 className={styles.title}>ページが見つかりません</h1>
        <p className={styles.lead}>
          お探しのページは移動したか、URLが間違っている可能性があります。
        </p>
        <Link href="/" className={styles.button}>
          写真の変換をはじめる
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
