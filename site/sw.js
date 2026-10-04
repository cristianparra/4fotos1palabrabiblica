// Service worker: la interfaz funciona sin conexión y las imágenes/consultas ya vistas se guardan.
// Al publicar cambios en el sitio, sube el número de VERSION para que se renueve la caché.
const VERSION = "v1";
const APP = `4fotos-app-${VERSION}`;
const IMGS = `4fotos-img-${VERSION}`;
const MAX_IMGS = 150;

const SHELL = [
  "/", "/index.html", "/privacidad.html", "/manifest.webmanifest",
  "/style.css?v=3", "/ppt.js?v=3", "/puzzles.js?v=3", "/game.js?v=3", "/vendor/pptxgen.bundle.js?v=3",
  "/icons/icon-192.png", "/icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== IMGS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMGS; i++) await cache.delete(keys[i]);
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req, cacheName, limit) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  // Se guardan respuestas correctas y las "opacas" (imágenes de otro dominio cargadas con <img>).
  if (res && (res.ok || res.type === "opaque")) {
    cache.put(req, res.clone());
    if (limit) trim(cache);
  }
  return res;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  if (url.origin === location.origin) {
    // Páginas: red primero (siempre la versión nueva) y caché si no hay conexión.
    if (req.mode === "navigate") return e.respondWith(networkFirst(req, APP));
    // Archivos del sitio: caché primero (las URLs llevan ?v= y cambian al actualizar).
    return e.respondWith(cacheFirst(req, APP));
  }
  // Consultas a Wikipedia: red primero, así los niveles ya vistos abren sin conexión.
  if (url.hostname === "es.wikipedia.org") return e.respondWith(networkFirst(req, IMGS));
  // Imágenes de Wikimedia: caché primero, con tope para no llenar el dispositivo.
  if (/(^|\.)wikimedia\.org$/.test(url.hostname)) return e.respondWith(cacheFirst(req, IMGS, true));
});
