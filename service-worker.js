'use strict';
/* BASMALA HUB service worker
   - app files: network first (fresh when online), cache fallback (works offline)
   - images: cache first
   Bump VERSION on every release so old caches are cleaned. */
const VERSION = 'basmala-hub-v34';
const SHELL = ['./', 'index.html', 'app.js', 'style.css', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('basmala-hub-') && k !== VERSION)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cached(r) {
  return caches.match(r, { ignoreSearch: true })
    .then(h => h || (r.mode === 'navigate' ? caches.match('index.html') : undefined));
}

function networkFirst(r) {
  return new Promise(res => {
    let done = false;
    const out = x => { if (!done) { done = true; res(x); } };
    // slow network: fall back to cache after 4s, but keep waiting if nothing is cached
    const tm = setTimeout(() => cached(r).then(h => h && out(h)), 4000);
    fetch(r).then(n => {
      clearTimeout(tm);
      if (n && n.ok) { const cp = n.clone(); caches.open(VERSION).then(c => c.put(r, cp)); }
      out(n);
    }).catch(() => {
      clearTimeout(tm);
      cached(r).then(h => out(h || Response.error()));
    });
  });
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (/\.(png|jpe?g|svg|ico|webp)$/i.test(u.pathname)) {
    e.respondWith(caches.match(r, { ignoreSearch: true }).then(h => h || fetch(r).then(n => {
      if (n && n.ok) { const cp = n.clone(); caches.open(VERSION).then(c => c.put(r, cp)); }
      return n;
    })));
    return;
  }
  e.respondWith(networkFirst(r));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if ('focus' in c) return c.focus();
      return self.clients.openWindow('./index.html');
    })
  );
});
