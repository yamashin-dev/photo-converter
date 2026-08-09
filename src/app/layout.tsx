import type { Metadata, Viewport } from "next";
import { DotGothic16, BIZ_UDPGothic } from "next/font/google";
import "./globals.css";
import { SITE } from "@/lib/site";
import { ThemeScript } from "@/components/ThemeScript";
import { Analytics } from "@/components/Analytics";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

/** ドット絵フォント。ロゴ・見出しのアクセントに限定して使う */
const display = DotGothic16({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

/** 本文。可読性重視のUD書体 */
const body = BIZ_UDPGothic({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  keywords: [
    "ドット絵変換",
    "ピクセルアート",
    "写真変換",
    "イラスト変換",
    "手描き風",
    "16bit",
    "ディザリング",
    "無料ツール",
  ],
  applicationName: SITE.name,
  alternates: { canonical: SITE.url },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    url: SITE.url,
    locale: "ja_JP",
    images: [{ url: "/ogp.png", width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
    images: ["/ogp.png"],
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#12141c" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  description: SITE.description,
  url: SITE.url,
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web Browser",
  browserRequirements: "JavaScriptを有効にしてください",
  offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
  featureList: [
    "ドット絵（ピクセルアート）変換",
    "手描き風イラスト変換",
    "9種類のディザリング",
    "8種類のカラーパレットと自動抽出",
    "ブラウザ内処理（画像を送信しない）",
    "オフライン利用可能",
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${display.variable} ${body.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          // 静的な定数のみを埋め込む（ユーザー入力は含まない）
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        <Analytics />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
