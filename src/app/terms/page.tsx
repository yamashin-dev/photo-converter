import type { Metadata } from "next";
import Link from "next/link";
import styles from "../legal.module.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: "利用規約",
  description: `${SITE.name}のご利用にあたっての条件について。`,
  alternates: { canonical: `${SITE.url}/terms` },
};

const UPDATED = "2026-08-09";

export default function TermsPage() {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <h1 className={styles.title}>利用規約</h1>
        <p className={styles.updated}>最終更新: {UPDATED}</p>

        <section className={styles.section}>
          <h2 className={styles.heading}>本サービスについて</h2>
          <div className={styles.body}>
            <p>
              {SITE.name}（以下「本サービス」）は、写真をドット絵や手描き風イラストに変換する無料のWebツールです。本規約に同意のうえご利用ください。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>変換した画像の権利</h2>
          <div className={styles.body}>
            <p>
              変換結果の権利は、元の画像の権利者に帰属します。当方は変換結果に対していかなる権利も主張しません。
            </p>
            <p>
              <strong>商用・非商用を問わず自由にご利用いただけます。</strong>
              クレジット表記も不要です。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>禁止事項</h2>
          <div className={styles.body}>
            <p>本サービスのご利用にあたり、次の行為はお控えください。</p>
            <ul>
              <li>権利者の許諾なく第三者の著作物を変換し、公開・配布すること</li>
              <li>他人の肖像を含む画像を、本人の同意なく不適切な形で利用すること</li>
              <li>法令や公序良俗に反する目的での利用</li>
              <li>本サービスへの過度な負荷を意図的にかける行為</li>
            </ul>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>動作環境</h2>
          <div className={styles.body}>
            <p>
              本サービスはブラウザ内で画像処理を行うため、端末の性能によって処理時間や扱える画像サイズが変わります。JavaScriptを有効にしたモダンブラウザの最新版でのご利用を推奨します。
            </p>
            <p>
              なお、極端に大きな画像は、端末を保護するために自動で縮小してから処理します。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>免責事項</h2>
          <div className={styles.body}>
            <p>
              本サービスは現状有姿で提供されます。変換結果の品質、特定目的への適合性は保証いたしません。
            </p>
            <p>
              本サービスの利用によって生じた損害について、当方は責任を負いかねます。大切な画像は必ず元データを保管したうえでご利用ください。
            </p>
            <p>
              予告なくサービス内容の変更・中断・終了を行う場合があります。
            </p>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.heading}>規約の変更</h2>
          <div className={styles.body}>
            <p>
              本規約は必要に応じて改定することがあります。変更後の規約は、本ページに掲載した時点から効力を持ちます。
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
