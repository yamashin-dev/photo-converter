/** サイト全体で共有する定数 */
export const SITE = {
  name: "フォトチェンジ",
  tagline: "写真をドット絵・手描き風イラストに変換",
  description:
    "写真をレトロなドット絵や手描き風イラストに変換できる無料ツール。変換はすべてブラウザ内で完結するため、画像がサーバーに送信されることはありません。",
  url: "https://photo-converter.yamashin-app.com",
  author: "やましん",
  authorUrl: "https://x.com/Yama_Shin_0216",
  /** GA4測定ID。未設定なら計測タグを読み込まない */
  gaId: process.env.NEXT_PUBLIC_GA_ID ?? "",
} as const;
