/** Berlangganan notifikasi push dari browser. Pasangan server: /api/push & src/lib/push-server.ts. */

export type StatusPush = "memeriksa" | "tidak-didukung" | "perlu-https" | "perlu-pasang-ios" | "ditolak" | "belum" | "aktif";

export const perangkatIos = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

const terpasang = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

function kunciKeBytes(base64url: string) {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const biner = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const hasil = new Uint8Array(new ArrayBuffer(biner.length));
  for (let i = 0; i < biner.length; i++) hasil[i] = biner.charCodeAt(i);
  return hasil;
}

async function langgananSekarang() {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function statusPush(): Promise<StatusPush> {
  if (typeof window === "undefined") return "tidak-didukung";
  if (!window.isSecureContext) return "perlu-https";
  const didukung = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // Safari iPhone/iPad hanya membuka Web Push untuk aplikasi yang sudah dipasang ke layar utama (iOS 16.4+).
  if (!didukung) return perangkatIos() && !terpasang() ? "perlu-pasang-ios" : "tidak-didukung";
  if (Notification.permission === "denied") return "ditolak";
  return (await langgananSekarang().catch(() => null)) ? "aktif" : "belum";
}

export async function aktifkanPush(): Promise<{ ok: boolean; pesan?: string }> {
  const izin = await Notification.requestPermission();
  if (izin !== "granted") return { ok: false, pesan: "Izin notifikasi tidak diberikan di browser." };
  const info = await fetch("/api/push").then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!info?.publicKey || !info?.tersedia) return { ok: false, pesan: "Notifikasi belum disiapkan di server." };
  await navigator.serviceWorker.register("/sw.js").catch(() => null);
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: kunciKeBytes(info.publicKey) });
  const r = await fetch("/api/push", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }),
  }).catch(() => null);
  return r?.ok ? { ok: true } : { ok: false, pesan: "Gagal menyimpan langganan. Coba lagi." };
}

export async function matikanPush() {
  const sub = await langgananSekarang().catch(() => null);
  if (!sub) return;
  await fetch("/api/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}

export async function kirimUjiPush(): Promise<{ ok: boolean; pesan: string }> {
  const r = await fetch("/api/push/uji", { method: "POST" }).catch(() => null);
  const d = await r?.json().catch(() => null);
  return r?.ok ? { ok: true, pesan: `Notifikasi uji dikirim ke ${d?.perangkat ?? 1} perangkat.` } : { ok: false, pesan: d?.error ?? "Gagal mengirim notifikasi uji." };
}
