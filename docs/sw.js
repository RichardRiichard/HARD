// Service worker: app funciona offline (exceto busca de livros e backup).
// Ao publicar uma versão nova, aumente VERSION para os aparelhos baixarem os arquivos novos.
const VERSION = '1.1.3';
const APP_CACHE = `leituras-app-${VERSION}`;
const COVERS_CACHE = 'leituras-capas';
const MAX_COVERS = 100;

// Todos os arquivos do app (o teste tests/sw.test.js garante que a lista está completa).
const PRECACHE = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/icon.svg',
  'js/app.js',
  'js/config.js',
  'js/core/calc.js',
  'js/core/dates.js',
  'js/core/progress.js',
  'js/core/stats.js',
  'js/core/transfer.js',
  'js/data/db.js',
  'js/data/store.js',
  'js/services/backup.js',
  'js/services/books-api.js',
  'js/services/drive.js',
  'js/services/files.js',
  'js/services/images.js',
  'js/services/link-info.js',
  'js/services/pdf.js',
  'js/ui/actions.js',
  'js/ui/banner.js',
  'js/ui/components.js',
  'js/ui/dom.js',
  'js/ui/icons.js',
  'js/ui/overlay.js',
  'js/ui/restore.js',
  'js/ui/sheets/add.js',
  'js/ui/sheets/article-form.js',
  'js/ui/sheets/book-form.js',
  'js/ui/sheets/book-search.js',
  'js/ui/sheets/entry.js',
  'js/ui/sheets/pdf-import.js',
  'js/ui/sheets/progress.js',
  'js/ui/views/history.js',
  'js/ui/views/home.js',
  'js/ui/views/item.js',
  'js/ui/views/library.js',
  'js/ui/views/settings.js',
  'js/ui/views/stats.js',
];

// Arquivos grandes baixados só quando usados (leitor de PDF) e guardados depois do primeiro uso.
const LAZY = ['vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js'];

// Arquivos buscados primeiro na rede (para mudanças valerem sem trocar VERSION).
// O manifest também: o Chrome lê dele, ao instalar, se o app aparece no "Compartilhar".
const NETWORK_FIRST = ['js/config.js', 'manifest.webmanifest'];

const COVER_HOSTS = ['covers.openlibrary.org', 'books.google.com', 'books.googleusercontent.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('leituras-app-') && k !== APP_CACHE).map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

/** Navegações não aceitam resposta "redirecionada" vinda do cache; recria sem o redirecionamento. */
async function unredirect(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
}

async function networkFirst(request) {
  const cache = await caches.open(APP_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

async function cacheFirst(request, store = false) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (store && response.ok) (await caches.open(APP_CACHE)).put(request, response.clone());
  return response;
}

/**
 * Capas: cache só de respostas com CORS. Respostas "opacas" (sem CORS) ocupariam ~7 MB de cota
 * cada no Chrome e poderiam pressionar o espaço dos seus dados; essas só aparecem quando há internet.
 */
async function coverCacheFirst(request) {
  const cache = await caches.open(COVERS_CACHE);
  const cached = await cache.match(request.url);
  if (cached) return cached;
  let response;
  try {
    response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
  } catch {
    return fetch(request);
  }
  if (response.ok) {
    await cache.put(request.url, response.clone());
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_COVERS))) await cache.delete(key);
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (request.mode === 'navigate') {
      // Rotas são por hash, então toda navegação é a página inicial do app.
      event.respondWith(
        caches
          .match('./')
          .then((r) => (r ? unredirect(r) : fetch(request)))
          .catch(() => fetch(request)),
      );
      return;
    }
    const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
    event.respondWith(NETWORK_FIRST.includes(path) ? networkFirst(request) : cacheFirst(request, LAZY.includes(path)));
    return;
  }

  if (COVER_HOSTS.includes(url.hostname)) {
    event.respondWith(coverCacheFirst(request).catch(() => Response.error()));
  }
  // Demais (APIs de busca, Google, Drive): sempre rede, sem cache.
});
