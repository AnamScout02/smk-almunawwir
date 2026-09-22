// Service worker minimal & KONSERVATIF — tujuan utama cuma bikin app "installable" (PWA), BUKAN
// caching agresif. Data sekolah (nilai, absensi, jadwal) berubah tiap saat, jadi:
//   - Navigasi halaman (HTML)  → SELALU network-first (fetch jaringan dulu; fallback ke cache
//     HANYA kalau device benar2 offline) — supaya user TIDAK PERNAH melihat data usang tanpa sadar.
//   - Asset statis (_next/static, /icons, gambar publik) → cache-first (aman di-cache lama,
//     nama file sudah content-hashed oleh Next.js untuk _next/static).
// TIDAK melakukan precaching daftar URL di install (app ini terlalu dinamis/personalized per role
// utk itu bermanfaat) — cache diisi lazy saat resource benar2 diakses (runtime caching).
// v2 (14 Sep 2026): ikon aplikasi diganti logo bundar — versi baru membuang cache ikon lama yang
// tersimpan cache-first. Naikkan lagi setiap gambar di /icons atau /images diganti di tempat.
// Ikon dari Logo Lambang (/ikon-aplikasi/…) SENGAJA tidak di-cache di sini (selalu dari jaringan).
const CACHE_NAME = "almunawwir-static-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/images/") ||
    url.pathname === "/favicon.png"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // jangan pernah cache POST/PUT (mutasi data)

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // jangan ganggu request pihak ketiga

  // Navigasi halaman (mis. buka /dashboard/admin) — network-first, fallback offline page.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((res) => res || Response.error())
      )
    );
    return;
  }

  // Asset statis — cache-first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // Selain itu (API, dsb) — biarkan lewat jaringan biasa, TIDAK di-intercept (data sekolah harus
  // selalu fresh, lihat komentar di atas).
});

// ---------------------------------------------------------------------------------------------
// NOTIFIKASI PUSH (14 Sep 2026) — pasangan src/lib/push-server.ts. Muatan JSON: { judul, isi, url, tag }.
// Ketuk notifikasi → fokus ke tab/aplikasi yang sudah terbuka di situs ini lalu pindah ke `url`, atau buka
// jendela baru kalau belum ada.
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { isi: event.data ? event.data.text() : "" }; }
  const judul = data.judul || "SMK Al Munawwir IIBS";
  event.waitUntil(
    self.registration.showNotification(judul, {
      body: data.isi || "",
      icon: "/ikon-aplikasi/any-192.png",
      badge: "/ikon-aplikasi/maskable-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/login" },
      lang: "id",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tujuan = new URL((event.notification.data && event.notification.data.url) || "/login", self.location.origin).href;
  event.waitUntil((async () => {
    const semua = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of semua) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        await c.focus();
        if ("navigate" in c) { try { await c.navigate(tujuan); } catch { /* halaman lintas-origin */ } }
        return;
      }
    }
    await self.clients.openWindow(tujuan);
  })());
});
