// ============================================================
//  Tally — service worker.
//
//  Deliberately network-first, not cache-first.
//
//  A money app that shows a stale ledger, or runs last week's code against
//  this week's database, is worse than one that takes another 200ms to
//  open. So every same-origin request goes to the network first and the
//  cache is the fallback; the cache exists to keep the app usable on a
//  train, not to make it a millisecond faster on a good connection.
//
//  Nothing cross-origin is touched at all — Supabase's REST and realtime
//  endpoints, Google's sign-in script and the supabase-js bundle all pass
//  straight through. Caching an API response here would be a way to show
//  someone yesterday's balance and call it today's.
// ============================================================

const VERSION = "tally-v5";
const SHELL = [
  "./",
  "./index.html",
  "./app.js?v=5",
  "./store.js?v=5",
  "./money.js?v=5",
  "./i18n.js?v=5",
  "./supabase-config.js?v=5",
  "./styles.css?v=5",
  "./favicon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./site.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      // addAll fails the whole install if any single file 404s. These are
      // the files the app cannot start without, so that is the right
      // behaviour — but the catch keeps a missing optional asset from
      // leaving the site with no worker at all.
      cache.addAll(SHELL).catch((e) => {
        console.warn("Tally SW: partial precache", e);
      })
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // version.json is how the running app finds out a new one was deployed.
  // Answering it from the cache would mean it never could.
  if (url.pathname.endsWith("version.json")) {
    event.respondWith(fetch(request).catch(() => new Response("{}", {
      headers: { "Content-Type": "application/json" },
    })));
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only store real, complete answers. An opaque or partial response
        // cached here would be served back as though it were the file.
        if (response && response.status === 200 && response.type === "basic") {
          const copy = response.clone();
          caches.open(VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request, { ignoreSearch: false });
        if (cached) return cached;
        // A cache-buster in the query string must not hide a file we do
        // have — try again ignoring it.
        const loose = await caches.match(request, { ignoreSearch: true });
        if (loose) return loose;
        // A navigation with nothing cached at all still gets the shell,
        // which can then show its own offline state.
        if (request.mode === "navigate") {
          const shell = await caches.match("./index.html");
          if (shell) return shell;
        }
        return new Response("", { status: 504, statusText: "Offline" });
      })
  );
});
