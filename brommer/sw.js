// Offline support: network-first (always fresh when online), cache fallback.
const CACHE = 'brommer-bende-v1';
const ASSETS = [
  './',
  'css/style.css',
  'fonts/bc-700-latin.woff2',
  'fonts/bc-800-latin.woff2',
  'fonts/bc-800i-latin.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'index.html',
  'js/audio.js',
  'js/config.js',
  'js/data/levels.js',
  'js/data/mopeds.js',
  'js/data/riders.js',
  'js/data/themes.js',
  'js/engine/ai.js',
  'js/engine/race.js',
  'js/engine/track.js',
  'js/game/profile.js',
  'js/main.js',
  'js/render/background.js',
  'js/render/renderer.js',
  'js/render/sprites.js',
  'js/ui/controls.js',
  'js/ui/dom.js',
  'js/ui/hud.js',
  'js/ui/overlays.js',
  'js/ui/screens.js',
  'js/util.js',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => Promise.all(ASSETS.map((u) => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('brommer-bende-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (err) => {
        clearTimeout(t);
        reject(err);
      },
    );
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const net = fetch(req).then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
        return res;
      });
      net.catch(() => {});
      try {
        return await withTimeout(net, 4000);
      } catch (err) {
        const hit = await cache.match(req, { ignoreSearch: true });
        if (hit) return hit;
        if (req.mode === 'navigate') {
          const shell = await cache.match('./index.html');
          if (shell) return shell;
        }
        return net;
      }
    })(),
  );
});
