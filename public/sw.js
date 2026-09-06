// ShelfLife AI service worker.
//
// Provides application-shell caching and offline fallback for the PWA.
// API/data requests are not intentionally cached here.
const CACHE_PREFIX = 'shelflifeai-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v1`;
const SHELL_PATHS = ['/', '/ShelfLifeLogin'];
const PUBLIC_FILES = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png', '/favicon.ico'];

function isStaticAsset(url) {
  return url.origin === self.location.origin && !url.search && (
    url.pathname.startsWith('/_expo/static/') ||
    url.pathname.startsWith('/assets/') ||
    PUBLIC_FILES.includes(url.pathname)
  );
}

function isShell(url) {
  return !url.search && SHELL_PATHS.includes(url.pathname);
}

// Resolve CSS dependencies too, so a first offline reload has the complete shell.
async function cacheShell(cache) {
  const visited = new Set();
  async function save(path) {
    const url = new URL(path, self.location.origin);
    if (visited.has(url.href)) return;
    visited.add(url.href);
    const response = await fetch(url.href, { cache: 'reload', credentials: 'omit' });
    if (!response.ok || response.redirected) throw new Error(`Cannot cache ${url.pathname}`);
    await cache.put(url.href, response.clone());
    const type = response.headers.get('content-type') || '';
    if (type.includes('text/html') || type.includes('text/css')) {
      const text = await response.text();
      const references = type.includes('text/html')
        ? [...text.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1])
        : [...text.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)/g)].map(match => match[1]);
      await Promise.all(references.map(reference => {
        const asset = new URL(reference.replace(/&amp;/g, '&'), url);
        return isStaticAsset(asset) ? save(asset.href) : undefined;
      }));
    }
  }
  await Promise.all([...SHELL_PATHS, ...PUBLIC_FILES].map(save));
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cacheShell));
  // No skipWaiting: updates activate naturally once existing tabs close.
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  // Never intercept mutations, API calls, or third-party requests.
  if (request.method !== 'GET' || url.origin !== self.location.origin ||
      url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (isShell(url) && response.ok && !response.redirected) {
          await cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        // Only the public shell is cached; never persist dashboard HTML/data.
        if (isShell(url)) {
          const cached = await cache.match(url.pathname);
          if (cached) return cached;
        } else {
          return Response.redirect(new URL('/ShelfLifeLogin', self.location.origin).href, 302);
        }
        return new Response('ShelfLifeAI is offline. Connect and reload to download the app.', {
          status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    })());
  } else if (isStaticAsset(url)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      // Expo bundles/assets are content-addressed; public metadata stays network-first.
      if (cached && !PUBLIC_FILES.includes(url.pathname)) return cached;
      try {
        const response = await fetch(request);
        if (response.ok && !response.redirected) {
          await cache.put(request, response.clone()).catch(() => {});
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    })());
  }
});
