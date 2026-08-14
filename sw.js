// Finora service worker.
// Scope: caches the static app shell (HTML/CSS/JS/icons) only, so the app can
// open offline. It NEVER intercepts requests to Supabase or any other
// cross-origin host — financial data must always come from the network,
// never from a stale cache.
// Bump this on every deploy that changes cached files, so the update
// checker (js/update.js) has a real new worker to install and activate.
const CACHE_NAME = 'mfp-shell-v7';
const APP_SHELL = [
  '/', '/login.html', '/dashboard.html', '/manifest.json',
  '/css/reset.css', '/css/variables.css', '/css/global.css', '/css/layout.css',
  '/css/components.css', '/css/dashboard.css', '/css/expenses.css', '/css/reports.css',
  '/css/auth.css', '/css/responsive.css', '/css/utilities.css', '/css/install.css', '/css/quick-add.css', '/css/expense-category.css', '/css/settings.css',
  '/js/theme.js', '/js/config.runtime.js', '/js/supabase.js', '/js/utils.js', '/js/session.js', '/js/app.js', '/js/auth.js', '/js/pwa.js', '/js/update.js',
  '/assets/icons/icon-192.png', '/assets/icons/icon-512.png', '/assets/icons/favicon-32.png'
];

// Never cached: must always be read from the network so the in-app update
// checker sees the real, current deployed version.
const NEVER_CACHE = ['/version.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => null))))
    // NOTE: no self.skipWaiting() here on purpose — a newly installed worker
    // stays in "waiting" state until the user approves the update via the
    // Check for Updates screen, which posts SKIP_WAITING below. This is what
    // makes the update prompt meaningful instead of silently self-applying.
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Lets the page (js/update.js) force this worker to activate immediately
// once the user taps "Update Now", instead of waiting for all tabs to close.
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests for the static shell. Everything
  // else (Supabase REST/Auth/Storage, third-party CDNs, non-GET requests)
  // passes straight through to the network untouched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  if (NEVER_CACHE.includes(url.pathname)) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // Network-first for pages, so logged-in users always get fresh app code;
    // fall back to the cached shell only when offline.
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(cached => cached || caches.match('/login.html')))
    );
    return;
  }

  // Cache-first for static assets (css/js/icons), refreshed in the background.
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
