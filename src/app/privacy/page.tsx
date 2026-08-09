import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: `${SITE.name}における個人情報・画像データの取り扱いについて。`,
  alternates: { canonical: `${SITE.url}/privacy` },
};

const UPDATED = "2026-08-09";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <h1 className={styles.title}>プライバシーポリシー</h1>
        <p className={styles.updated}>最終更新: {UPDATED}</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>画像データの取り扱い</h2>
          <div className={styles.body}>
            <p>
              <strong>
                {SITE.name}にアップロードした写真は、お使いの端末の外に出ることはありません。
              </strong>
              変換処理はすべてブラウザ内（JavaScript）で完結しており、画像データをサーバーへ送信する仕組み自体を持っていません。
            </p>
            <p>
              そのため、当方が写真を保存・閲覧・第三者へ提供することはありません。ページを閉じると、読み込んだ画像はブラウザのメモリから破棄されます。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>ブラウザに保存する情報</h2>
          <div className={styles.body}>
            <p>
              使い勝手のため、以下の設定をお使いのブラウザ（localStorage）に保存します。これらは端末内に留まり、送信されることはありません。
            </p>
            <ul>
              <li>変換設定（スタイル、色数、ディザリングなどの選択内容）</li>
              <li>表示テーマ（ライト / ダーク）の選択</li>
              <li>アクセス解析への同意状況</li>
            </ul>
            <p>ブラウザの設定からいつでも削除できます。</p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>アクセス解析</h2>
          <div className={styles.body}>
            <p>
              サイト改善のため、Google アナリティクス（GA4）を利用する場合があります。
              <strong>初回訪問時に確認し、許可をいただいた場合にのみ計測を開始します。</strong>
              許可しない場合、計測用のスクリプトは読み込まれません。
            </p>
            <p>
              計測する内容は、閲覧ページ・滞在時間・おおまかな地域・利用ブラウザなどの統計情報です。IPアドレスは匿名化して扱います。変換した画像やファイル名が送信されることはありません。
            </p>
            <p>
              取得したデータはGoogle社のプライバシーポリシーに基づいて管理されます。詳細は
              <a
                href="https://policies.google.com/privacy?hl=ja"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google プライバシーポリシー
              </a>
              をご確認ください。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>オフライン利用について</h2>
          <div className={styles.body}>
            <p>
              本サイトはPWAとして動作し、一度読み込むとアプリ本体のファイルが端末にキャッシュされます。これは表示の高速化とオフライン利用のためであり、写真そのものが保存されるわけではありません。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>お問い合わせ</h2>
          <div className={styles.body}>
            <p>
              本ポリシーに関するお問い合わせは
              <a href={SITE.authorUrl} target="_blank" rel="noopener noreferrer">
                制作者のX（旧Twitter）
              </a>
              までお願いいたします。
            </p>
          </div>
        </section>

        <Link href="/" className={styles.back}>
          ← トップへ戻る
        </Link>
      </main>
      <SiteFooter />
    </>
  );
}
