/*
 * フォトチェンジ Service Worker
 *
 * 役割は2つ。
 * 1. アプリシェルをキャッシュしてオフラインでも変換できるようにする
 *    （変換はすべて端末内で動くので、資産さえ手元にあれば通信は不要）
 * 2. OSの共有メニューから送られてきた画像を受け取り、アプリへ橋渡しする
 *
 * BUILD_ID と PRECACHE_ASSETS は、ビルド後に scripts/generate-sw.mjs が
 * 実際の出力ファイル一覧で書き換える。ここにある値は開発用のひな形。
 */

const BUILD_ID = "dev";
const PRECACHE_ASSETS = [];

const SHELL_CACHE = `pc-shell-${BUILD_ID}`;
const SHARE_CACHE = "pc-share";

/** 最低限これだけあれば起動できるもの */
const SHELL_URLS = ["/", "/offline.html", "/manifest.webmanifest", ...PRECACHE_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // 1つでも失敗すると全滅するaddAllは使わず、個別に入れる
      .then((cache) =>
        Promise.all(
          SHELL_URLS.map((url) =>
            cache.add(new Request(url, { cache: "reload" })).catch(() => undefined)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("pc-shell-") && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      );
      // 共有で預かった画像を持ち越さない（端末に写真を残さないため）
      await caches.delete(SHARE_CACHE);
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 共有メニューからのPOSTを受け取り、画像をキャッシュに置いてトップへ戻す
  if (request.method === "POST" && url.pathname === "/share-target") {
    event.respondWith(handleShare(request));
    return;
  }

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // ハッシュ付きの静的アセットは内容が変わらないのでキャッシュ優先
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // アイコン等はファイル名が変わらないので、鮮度を優先しつつ失敗時に備える
  if (url.pathname.startsWith("/icons/") || url.pathname === "/ogp.png") {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  // ページ遷移はネットワーク優先。失敗したらキャッシュ、それも無ければオフライン用ページ
  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

/** 一定時間で消えるように、共有画像には受け取り時刻を添える */
async function handleShare(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("image");
    if (file) {
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        "/shared-image",
        new Response(file, {
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-Filename": encodeURIComponent(file.name || "shared"),
            "X-Received-At": String(Date.now()),
          },
        })
      );
    }
  } catch {
    // 受け取りに失敗してもアプリ自体は開く
  }
  return Response.redirect("/?shared=1", 303);
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

async function networkFirstPage(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match("/")) ||
      (await caches.match("/offline.html")) ||
      new Response("オフラインです", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error("offline");
  }
}
