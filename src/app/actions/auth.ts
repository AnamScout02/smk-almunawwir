"use server";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { setPendingTotpCookie, getPendingTotp, clearPendingTotpCookie } from "@/lib/session";
import { masukkanSesi, keluarkanSesiIni } from "@/lib/sesi-server";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { verifyTotpToken, consumeBackupCode } from "@/lib/totp";
import { REDIRECT_MAP, resolveRedirectTarget, ambilLanjut } from "@/lib/tujuan-masuk";
import { normalizePhoneKey } from "@/lib/parent-account";
import { DEFAULT_PASSWORD } from "@/lib/constants";

const loginSchema = z.object({
  email: z.string().includes("@"),
  password: z.string().min(6),
});

export type LoginState = {
  error?: string;
  /** true kalau email+password sudah benar TAPI akun ini butuh kode 2FA sebelum sesi dibuat —
   * lihat verifyLoginTotp() di bawah. Form login.tsx harus ganti tampilan jadi input kode kalau ini true. */
  needsTotp?: boolean;
} | undefined;

export async function login(state: LoginState, formData: FormData): Promise<LoginState> {
  // ORANG TUA BOLEH MASUK DENGAN NOMOR HP (11 Okt 2026): akun orang tua beralamat `ortu<62…>@smkalmunawwir.sch.id`,
  // dan mengetik alamat sepanjang itu di HP adalah salah satu sebab hampir tidak ada yang pernah masuk. Isian yang
  // hanya berisi angka (boleh +, spasi, tanda hubung) diterjemahkan ke alamat itu; selain itu perilakunya sama.
  const isian = String(formData.get("email") ?? "").trim();
  const angka = isian.replace(/[\s+()-]/g, "");
  const parsed = loginSchema.safeParse({
    email: !isian.includes("@") && /^\d{9,15}$/.test(angka) ? `ortu${normalizePhoneKey(angka)}@smkalmunawwir.sch.id` : isian,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Email atau password tidak valid." };
  }

  const { email, password } = parsed.data;
  // "Ingat saya" — lihat src/lib/session.ts: tidak dicentang = sesi habis saat browser ditutup /
  // 8 jam tanpa aktivitas (bawaan, aman untuk komputer TU/lab bersama); dicentang = 30 hari.
  const ingatSaya = formData.get("ingat") === "on";

  // Rate-limit login — celah brute-force nyata sebelum ini (endpoint publik lain sudah pakai
  // helper yang sama, login belum). Dua lapis: per-IP (longgar, 1 IP sering dipakai banyak orang
  // di lab/jaringan sekolah yang sama) DAN per-email (ketat, melindungi SATU akun spesifik dari
  // percobaan berulang biarpun penyerang gonta-ganti IP).
  const ip = getClientIpFromHeaders(await headers());
  if (!checkRateLimit(`login-ip:${ip}`, 20, 5 * 60_000) || !checkRateLimit(`login-email:${email}`, 5, 5 * 60_000)) {
    return { error: "Terlalu banyak percobaan login. Coba lagi dalam beberapa menit." };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: "Email atau password salah." };
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return { error: "Email atau password salah." };
  }

  if (user.role === "STUDENT") {
    const student = await prisma.student.findUnique({ where: { userId: user.id }, select: { studentStatus: true } });
    if (student && student.studentStatus && student.studentStatus !== "AKTIF") {
      return { error: "Akun ini sudah tidak aktif (status: " + student.studentStatus + "). Hubungi TU jika ini keliru." };
    }
  }

  // 2FA — KHUSUS admin yang sudah mengaktifkan (lihat src/lib/totp.ts kenapa dibatasi role ini
  // saja, bukan semua role). Password sudah benar, tapi sesi SUNGGUHAN belum dibuat sampai kode
  // TOTP juga benar — lihat verifyLoginTotp() di bawah.
  if (user.role === "ADMIN" && user.totpEnabled) {
    await setPendingTotpCookie(user.id, ingatSaya);
    return { needsTotp: true };
  }

  // Masuk dengan SANDI AWAL yang sama untuk semua akun baru → wajib menggantinya (jendela di portal, `GantiSandiWajib`).
  // Ditandai di sini karena hanya saat login sandi polosnya diketahui; admin ber-2FA tidak lewat jalur ini.
  if (password === DEFAULT_PASSWORD && !user.wajibGantiSandi) await prisma.user.update({ where: { id: user.id }, data: { wajibGantiSandi: true } }).catch(() => null);
  await masukkanSesi({ id: user.id, name: user.name, email: user.email, role: user.role }, ingatSaya);

  redirect((await ambilLanjut()) ?? await resolveRedirectTarget(user.role, user.email));
}

/** Langkah kedua login kalau login() tadi mengembalikan `needsTotp: true` — verifikasi kode 6
 * digit dari authenticator app (atau salah satu kode cadangan sekali-pakai), baru sesi
 * sungguhan dibuat di sini. */
export async function verifyLoginTotp(state: LoginState, formData: FormData): Promise<LoginState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { needsTotp: true, error: "Masukkan kode dari aplikasi authenticator." };

  const pending = await getPendingTotp();
  const pendingUserId = pending?.userId;
  if (!pending || !pendingUserId) {
    return { error: "Sesi login kadaluarsa (lebih dari 5 menit). Silakan login ulang." };
  }

  // Rate-limit percobaan kode — tanpa ini kode 6-digit (1 juta kemungkinan) bisa ditebak brute-force.
  if (!checkRateLimit(`totp-verify:${pendingUserId}`, 8, 5 * 60_000)) {
    await clearPendingTotpCookie();
    return { error: "Terlalu banyak percobaan kode salah. Silakan login ulang." };
  }

  const user = await prisma.user.findUnique({ where: { id: pendingUserId } });
  if (!user || !user.totpEnabled || !user.totpSecret) {
    await clearPendingTotpCookie();
    return { error: "Sesi login tidak valid. Silakan login ulang." };
  }

  let valid = await verifyTotpToken(code, user.totpSecret);
  if (!valid) valid = await consumeBackupCode(user.id, code);
  if (!valid) return { needsTotp: true, error: "Kode salah atau sudah kedaluwarsa." };

  await clearPendingTotpCookie();
  await masukkanSesi({ id: user.id, name: user.name, email: user.email, role: user.role }, pending.ingatSaya);
  redirect((await ambilLanjut()) ?? REDIRECT_MAP[user.role] ?? "/dashboard/student");
}

export async function logout() {
  // Mencabut baris UserSession perangkat ini (bukan sekadar menghapus cookie) — token segar yang
  // sama tidak bisa dipakai lagi walau sempat tersalin. Selama "Masuk Sebagai", yang tercabut
  // adalah sesi admin itu sendiri, jadi tidak ada lagi cookie impersonator basi yang tertinggal.
  await keluarkanSesiIni();
  await clearPendingTotpCookie();
  // ?keluar=1 → halaman login melepas langganan notifikasi push perangkat ini (lihat login/page.tsx).
  redirect("/login?keluar=1");
}
