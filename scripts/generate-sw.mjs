/**
 * ビルド後にService Workerを仕上げるスクリプト。
 *
 * public/sw.js はひな形で、実際に配信されるアセットのURLを知らない。
 * ここで out/ を走査して次の2つを埋め込む。
 *  - BUILD_ID: ビルドごとに変わる値（古いキャッシュを確実に捨てるため）
 *  - PRECACHE_ASSETS: 各ページのHTMLが実際に参照しているJS/CSSとフォント
 *    （これが無いとオフライン起動時にスクリプトが解決できず白画面になる）
 *
 * 動的import（HEICデコーダのWASM等）はプリキャッシュしない。
 * 初回インストールを重くしないためで、一度使えばcacheFirstで手元に残る。
 */

import { createHash } from "node:crypto";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = "out";
/** プリキャッシュ対象にするページ（これらがオフラインで開ける） */
const PAGES = ["index.html", "terms.html", "privacy.html", "offline.html"];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const full = join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : Promise.resolve([full]);
    })
  );
  return files.flat();
}

/** HTMLが参照している同一オリジンのJS/CSSを拾う */
function extractRefs(html) {
  const refs = new Set();
  const patterns = [/<script[^>]+src="([^"]+)"/g, /<link[^>]+href="([^"]+)"/g];
  for (const re of patterns) {
    for (const [, url] of html.matchAll(re)) {
      if (url.startsWith("/_next/") && (url.endsWith(".js") || url.endsWith(".css"))) {
        refs.add(url);
      }
    }
  }
  return refs;
}

const assets = new Set();

for (const page of PAGES) {
  try {
    const html = await readFile(join(OUT_DIR, page), "utf8");
    for (const ref of extractRefs(html)) assets.add(ref);
  } catch {
    // 生成されていないページはスキップ
  }
}

// 日本語フォントはUnicode範囲ごとに数百のサブセットへ分割されており、
// 全部入れると5MBを超える。ブラウザは必要な範囲だけ取りに行き、
// それはcacheFirstで手元に残るのでプリキャッシュはしない。
// （未取得の範囲がオフラインで出た場合は代替フォントで表示される）

const sorted = [...assets].sort();

// 全出力ファイルの内容からビルドIDを作る（同じ出力なら同じIDになる）
const allFiles = (await walk(join(OUT_DIR, "_next", "static"))).sort();
const hash = createHash("sha256");
for (const file of allFiles) hash.update(await readFile(file));
const buildId = hash.digest("hex").slice(0, 12);

const swPath = join(OUT_DIR, "sw.js");
const template = await readFile(swPath, "utf8");

const generated = template
  .replace('const BUILD_ID = "dev";', `const BUILD_ID = ${JSON.stringify(buildId)};`)
  .replace(
    "const PRECACHE_ASSETS = [];",
    `const PRECACHE_ASSETS = ${JSON.stringify(sorted, null, 2)};`
  );

if (generated === template) {
  throw new Error("sw.js のプレースホルダを置換できませんでした（ひな形が変わっていないか確認）");
}

await writeFile(swPath, generated);

const bytes = (
  await Promise.all(sorted.map(async (a) => (await stat(join(OUT_DIR, a.slice(1)))).size))
).reduce((a, b) => a + b, 0);

const skipped = allFiles.length - sorted.length;
console.log(
  `sw.js を生成しました: build=${buildId} / プリキャッシュ${sorted.length}件 ${(bytes / 1024).toFixed(0)}KB` +
    `（初回は取得せず必要時に取りに行くファイル: ${skipped}件）`
);
