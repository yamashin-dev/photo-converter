import { Converter } from "@/components/Converter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ConsentBanner } from "@/components/ConsentBanner";
import { faqJsonLd } from "@/components/Showcase";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      {/* ページに実際に表示しているFAQと同じ内容を機械可読な形でも渡す */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <SiteHeader />
      <main className={styles.main}>
        <Converter />
      </main>
      <SiteFooter />
      <ConsentBanner />
    </>
  );
}
