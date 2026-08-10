import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { SessionPayload } from "@/types";

const secretKey = process.env.SESSION_SECRET;
const encodedKey = new TextEncoder().encode(secretKey);

// Sesi "sliding window", BUKAN fixed-expiry — durasi ini dipakai baik saat login pertama kali
// MAUPUN tiap kali diperpanjang otomatis oleh proxy.ts di setiap request (lihat refreshSessionCookie
// di bawah). Selama user masih aktif (buka halaman apa pun di /dashboard), sesi terus mundur lagi
// 8 jam dari SEKARANG — user TIDAK akan ke-logout paksa selama aktif. Kalau benar2 idle (tidak ada
// request sama sekali) lebih dari 8 jam, baru sesi kadaluarsa beneran & wajib login ulang. Dipilih
// 8 jam (bukan 7 hari seperti sebelumnya) atas permintaan eksplisit user — device di TU/lab sekolah
// sering dipakai bergantian, sesi multi-hari terlalu berisiko kalau lupa logout.
const SESSION_DURATION_STR = "8h";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

export async function encrypt(payload: SessionPayload) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION_STR)
    .sign(encodedKey);
}

export async function decrypt(session: string | undefined = "") {
  if (!session) return null;
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(payload: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ ...payload, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

/** Perpanjang sesi 8 jam lagi dari SEKARANG — dipanggil dari proxy.ts di HAMPIR SETIAP request
 * (halaman maupun API) yang membawa cookie sesi valid. Re-sign JWT baru (bukan cuma geser
 * `expires` cookie) karena validitas sebenarnya ditentukan oleh klaim `exp` di dalam JWT itu
 * sendiri (dicek jwtVerify di decrypt()) — sekadar menggeser `expires` cookie tanpa re-sign JWT
 * tidak akan memperpanjang apa-apa, JWT lama tetap kadaluarsa di waktu semula. */
export async function refreshSessionCookie(res: NextResponse, payload: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await encrypt({ ...payload, expiresAt });
  res.cookies.set("session", session, {
    httpOnly: true,
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  return decrypt(sessionCookie);
}

// ── Masuk Sebagai (impersonasi akun) ──────────────────────────────────────
// Khusus ADMIN (superadmin) — lihat src/app/api/admin/users/[id]/impersonate/route.ts. Saat
// admin "masuk sebagai" akun lain, identitas admin ASLI disimpan di cookie terpisah `impersonator`
// (bukan ditimpa), supaya bisa dipulihkan lagi lewat tombol "Kembali ke akun Admin" tanpa perlu
// login ulang. Cookie `session` (yang dipakai verifyRole/proxy.ts utk otorisasi) ditimpa jadi
// identitas akun yang diimpersonasi — sengaja begitu supaya semua guard existing otomatis bekerja
// tanpa perlu tahu soal impersonasi sama sekali. Cookie `impersonator` TIDAK ikut diperpanjang
// oleh sliding window proxy.ts (cuma cookie `session` yang direfresh) — dibiarkan begitu supaya
// kemampuan "kembali ke admin" tidak menggantung selamanya kalau impersonasi dibiarkan lama.
export async function setImpersonatorCookie(payload: Omit<SessionPayload, "expiresAt">) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = await encrypt({ ...payload, expiresAt });
  const cookieStore = await cookies();
  cookieStore.set("impersonator", token, {
    httpOnly: true,
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    expires: expiresAt,
    sameSite: "lax",
    path: "/",
  });
}

export async function getImpersonatorSession() {
  const cookieStore = await cookies();
  return decrypt(cookieStore.get("impersonator")?.value);
}

export async function clearImpersonatorCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("impersonator");
}
