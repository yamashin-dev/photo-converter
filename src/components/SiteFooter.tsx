import Link from "next/link";
import styles from "./SiteFooter.module.css";
import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <hr className="dottedRule" />
      <div className={styles.inner}>
        <p className={styles.note}>
          変換処理はすべてブラウザ内で実行され、画像がサーバーへ送信されることはありません。
        </p>
        <nav className={styles.links} aria-label="サイト情報">
          <Link href="/terms">利用規約</Link>
          <Link href="/privacy">プライバシーポリシー</Link>
          <a href={SITE.authorUrl} target="_blank" rel="noopener noreferrer">
            制作者
          </a>
        </nav>
      </div>
    </footer>
  );
}
