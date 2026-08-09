import { Converter } from "@/components/Converter";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ConsentBanner } from "@/components/ConsentBanner";
import styles from "./page.module.css";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className={styles.main}>
        <Converter />
      </main>
      <SiteFooter />
      <ConsentBanner />
    </>
  );
}
