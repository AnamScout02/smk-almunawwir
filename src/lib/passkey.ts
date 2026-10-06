import "server-only";
import { randomBytes } from "crypto";

/** PASSKEY — masuk dengan sidik jari / wajah / PIN perangkat (WebAuthn, 5 Oktober 2026).
 *
 * Yang dijaga dan alasannya:
 * - **Domain & origin dihitung PER PERMINTAAN dari X-Forwarded-Proto + Host**, bukan `req.url`: di Next standalone
 *   `req.url` = `http://<hostname>:3000/…` (pelajaran SEB, CLAUDE.md #117). Passkey hanya bisa dipakai lewat HTTPS
 *   (syarat browser), jadi permintaan lewat `http://<ip>:3000` ditolak dengan pesan jelas.
 * - Passkey terikat DOMAIN tempat ia dibuat (`Passkey.rpId`): yang dibuat di domain sekolah tidak berlaku di alamat
 *   terowongan lama, dan sebaliknya.
 * - Wajib verifikasi pengguna (sidik jari/wajah/PIN) — karena itu admin ber-2FA tidak diminta kode lagi: passkey
 *   sendiri sudah dua faktor (perangkat + biometrik/PIN).
 * - Tantangan sekali pakai disimpan di memori (satu proses Node, pola sinyal-ujian.ts) dengan kunci acak di cookie
 *   HttpOnly, berlaku 5 menit.
 * - SISWA tidak memakai passkey: akun siswa banyak dibuka di komputer lab bersama. */
export const PERAN_PASSKEY = ["ADMIN", "TAS", "TEACHER", "PARENT"] as const;
export const bolehPasskey = (role: string) => (PERAN_PASSKEY as readonly string[]).includes(role);

export const NAMA_RP = "SMK Al-Munawwir IIBS";

/** Origin yang dikirim WebView aplikasi MyAlwis Mobile (v2.4+, mode WEB_AUTHENTICATION_SUPPORT_FOR_APP):
 *  `android:apk-key-hash:` + SHA-256 sertifikat penandatangan APK (base64url). Aplikasi dibuktikan milik domain ini
 *  lewat public/.well-known/assetlinks.json — keduanya WAJIB diganti bersama bila kunci rilis APK diganti. */
export const ORIGIN_APLIKASI = "android:apk-key-hash:97LbI3npibY2tyjQB3RbE9kKnG3jNo2T17DmDb7Tx5I";
export const COOKIE_TANTANGAN = "passkey_tantangan";

export function pihakTerpercaya(h: Headers): { rpID: string; origin: string } | null {
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const rpID = host.replace(/:\d+$/, "");
  if (!rpID) return null;
  if (proto !== "https" && rpID !== "localhost") return null;
  return { rpID, origin: `${proto}://${host}` };
}

type Tantangan = { challenge: string; userId?: string; tujuan: "daftar" | "masuk"; kadaluwarsa: number };
const g = globalThis as unknown as { __passkeyTantangan?: Map<string, Tantangan> };
const peta = (g.__passkeyTantangan ??= new Map());

export function simpanTantangan(t: Omit<Tantangan, "kadaluwarsa">): string {
  const sekarang = Date.now();
  for (const [k, v] of peta) if (v.kadaluwarsa < sekarang) peta.delete(k);
  const kunci = randomBytes(18).toString("base64url");
  peta.set(kunci, { ...t, kadaluwarsa: sekarang + 5 * 60_000 });
  return kunci;
}

/** Ambil SEKALI — tantangan yang sudah dipakai (berhasil maupun gagal) tidak bisa dipakai ulang. */
export function ambilTantangan(kunci: string | undefined, tujuan: Tantangan["tujuan"]): Tantangan | null {
  if (!kunci) return null;
  const t = peta.get(kunci);
  peta.delete(kunci);
  if (!t || t.tujuan !== tujuan || t.kadaluwarsa < Date.now()) return null;
  return t;
}

export const opsiCookieTantangan = (secure: boolean) =>
  ({ httpOnly: true, sameSite: "strict" as const, secure, path: "/api/passkey", maxAge: 300 });
