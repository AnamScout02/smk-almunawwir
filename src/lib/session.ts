import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import type { SessionPayload } from "@/types";

/* SISTEM SESI DUA TOKEN (14 September 2026) — pasangan berkas: src/lib/sesi-server.ts (database)
 * dan src/proxy.ts (penyegaran diam-diam).
 *
 *   Cookie `session`    = TOKEN AKSES. JWT berumur 15 menit berisi identitas + `sid`. Dibaca tiap
 *                         request tanpa menyentuh database; kalau tercuri, cepat basi.
 *   Cookie `sesi_segar` = TOKEN SEGAR. 256 bit acak; database hanya menyimpan hash SHA-256-nya
 *                         (tabel UserSession). Saat token akses habis, proxy.ts menerbitkan yang baru
 *                         di balik layar — pengguna tidak pernah melihatnya, jadi tidak "logout sendiri".
 *
 * "Ingat saya" hanya mengatur umur cookie token segar:
 *   - tidak dicentang → cookie sesi browser (hilang saat browser ditutup) + habis 8 jam sejak aktif
 *     terakhir. Ini TETAP bawaan: keputusan lama user, komputer TU/lab dipakai bergantian.
 *   - dicentang       → 30 hari, bergeser tiap kali dipakai.
 */

export const COOKIE_AKSES = "session";
export const COOKIE_SEGAR = "sesi_segar";
export const AKSES_MS = 15 * 60 * 1000;
export const IDLE_MS = 8 * 60 * 60 * 1000;
export const INGAT_MS = 30 * 24 * 60 * 60 * 1000;

const encodedKey = new TextEncoder().encode(process.env.SESSION_SECRET);

type BacaHeader = { get(name: string): string | null } | null | undefined;

/** `Secure` mengikuti cara situs dibuka PADA REQUEST INI, bukan satu setelan global. Situs yang sama
 * dibuka dua jalur sekaligus: HTTP langsung di jaringan sekolah (`http://<IP-PUBLIK-SERVER>:3000`) dan
 * HTTPS lewat terowongan Tailscale Funnel (pembungkus TLS-nya mengirim `X-Forwarded-Proto: https`).
 * Secure=true di jalur HTTP membuat browser MENOLAK menyimpan cookie → tidak ada yang bisa login;
 * Secure=false di jalur HTTPS masih jalan, hanya kurang ketat. Karena itu tanpa header proto,
 * cadangannya NEXT_PUBLIC_APP_URL (perilaku lama). Header palsu dari klien hanya merugikan dirinya
 * sendiri (cookie-nya ditolak browsernya). */
export function pakaiSecure(h?: BacaHeader) {
  const proto = h?.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  if (proto) return proto === "https";
  return (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
}

/** Tanpa expires/maxAge = cookie sesi browser; masa berlaku sebenarnya dijaga klaim `exp` JWT.
 * `h` = header request yang sedang dilayani (lihat pakaiSecure). */
export function opsiCookieAkses(h?: BacaHeader) {
  return { httpOnly: true, secure: pakaiSecure(h), sameSite: "lax" as const, path: "/" };
}

export function opsiCookieSegar(ingatSaya: boolean, h?: BacaHeader) {
  return {
    httpOnly: true, secure: pakaiSecure(h), sameSite: "lax" as const, path: "/",
    ...(ingatSaya ? { maxAge: Math.floor(INGAT_MS / 1000) } : {}),
  };
}

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(encodedKey);
}

export async function decrypt(token: string | undefined = "") {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Isi token akses request ini (sudah disegarkan proxy.ts kalau perlu). TIDAK memeriksa apakah
 * sesinya dicabut — untuk otorisasi selalu pakai verifySession/verifyRole di dal.ts. */
export async function getSession() {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get(COOKIE_AKSES)?.value);
}

/** Identitas Admin asli selama "Masuk Sebagai". Dulu cookie terpisah `impersonator` — kini dibawa
 * token akses (`imp`) dan dicatat di baris UserSession, sehingga tidak bisa lagi "nyangkut" basi
 * setelah logout (bug nyata 2026-08-13 yang dulu harus ditambal manual di logout). */
export async function getImpersonatorSession() {
  const s = await getSession();
  return s?.imp ?? null;
}

export async function hapusCookieSesi() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_AKSES);
  cookieStore.delete(COOKIE_SEGAR);
  cookieStore.delete("impersonator"); // sisa sistem lama, kalau masih ada
}

// ── 2FA login step (khusus ADMIN dengan totpEnabled=true) ────────────────
// Setelah email+password valid TAPI akun butuh kode TOTP, sesi SUNGGUHAN belum dibuat — cuma
// cookie sementara 5 menit berisi userId (+ pilihan "ingat saya"), supaya langkah kedua tahu akun
// mana yang sedang login tanpa perlu password lagi, tapi tidak bisa dipakai untuk apa pun.
const PENDING_TOTP_DURATION_MS = 5 * 60 * 1000;

export async function setPendingTotpCookie(userId: string, ingatSaya = false) {
  const token = await new SignJWT({ userId, ingatSaya })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(encodedKey);
  const cookieStore = await cookies();
  cookieStore.set("pending_2fa", token, {
    httpOnly: true, secure: pakaiSecure(await headers()), sameSite: "lax", path: "/",
    expires: new Date(Date.now() + PENDING_TOTP_DURATION_MS),
  });
}

export async function getPendingTotp(): Promise<{ userId: string; ingatSaya: boolean } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("pending_2fa")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return typeof payload.userId === "string" ? { userId: payload.userId, ingatSaya: payload.ingatSaya === true } : null;
  } catch {
    return null;
  }
}

export async function clearPendingTotpCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("pending_2fa");
}
