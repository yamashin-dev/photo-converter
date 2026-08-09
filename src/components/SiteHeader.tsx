import Link from "next/link";
import styles from "./SiteHeader.module.css";
import { ThemeToggle } from "./ThemeToggle";
import { SITE } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          <span className={styles.name}>{SITE.name}</span>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
