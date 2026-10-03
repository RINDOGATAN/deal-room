// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2025-2026 Rindogatan LLC

/**
 * Tell the IndexNow search engines (Bing, Yandex, Seznam, Naver; Bing's index
 * feeds ChatGPT search and Copilot) that the public pages are new or changed.
 * Reads every address from the live sitemap and posts them in one call.
 * The key is public by design: it is served at /af51fd7577abcd4a832b4dc545d3f568.txt to prove the site is ours.
 *
 *   node scripts/indexnow.mjs            # every sitemap address
 *   node scripts/indexnow.mjs /contracts/nda /es/contracts/nda
 */
const HOST = "dealroom.todo.law";
const KEY = "af51fd7577abcd4a832b4dc545d3f568";

const paths = process.argv.slice(2);
let urlList;
if (paths.length > 0) {
  urlList = paths.map((p) => `https://${HOST}${p.startsWith("/") ? p : `/${p}`}`);
} else {
  const xml = await (await fetch(`https://${HOST}/sitemap.xml`)).text();
  urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
});
console.log(`IndexNow: ${urlList.length} addresses, HTTP ${res.status}`);
if (!res.ok && res.status !== 202) process.exit(1);
