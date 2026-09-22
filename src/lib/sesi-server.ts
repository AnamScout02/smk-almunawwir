import "server-only";
import { createHash, randomBytes } from "crypto";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getClientIpFromHeaders } from "@/lib/rate-limit";
import {
  AKSES_MS, COOKIE_AKSES, COOKIE_SEGAR, IDLE_MS, INGAT_MS,
  decrypt, encrypt, opsiCookieAkses, opsiCookieSegar,
} from "@/lib/session";
import type { Role, SessionPayload } from "@/types";

/** Pekerjaan sesi yang menyentuh DATABASE (tabel UserSession). Pasangan src/lib/session.ts
 * (token & cookie) dan src/proxy.ts (penyegaran diam-diam). */

type Identitas = { id: string; name: string; email: string; role: string };
export type InfoPerangkat = { userAgent: string | null; ip: string | null };

export const KUNCI_SESI_TUNGGAL = "auth.sesiTunggal";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
const batasBaru = (ingatSaya: boolean) => new Date(Date.now() + (ingatSaya ? INGAT_MS : IDLE_MS));
const ringkasUA = (ua: string | null) => (ua ? ua.slice(0, 400) : null);

function payloadDari(u: Identitas, sid: string, admin: Identitas | null): SessionPayload {
  return {
    userId: u.id, name: u.name, email: u.email, role: u.role as Role, sid,
    imp: admin ? { userId: admin.id, name: admin.name, email: admin.email, role: admin.role as Role } : null,
    expiresAt: new Date(Date.now() + AKSES_MS),
  };
}

/** Peran yang dibatasi SATU perangkat aktif (Keamanan & Sesi Login). Bawaan: tidak ada. */
export async function peranSesiTunggal(): Promise<string[]> {
  const row = await prisma.siteSetting.findUnique({ where: { key: KUNCI_SESI_TUNGGAL } }).catch(() => null);
  try {
    const v = JSON.parse(row?.value ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch { return []; }
}

async function terbitkan(user: Identitas, ingatSaya: boolean, info: InfoPerangkat, terapkanSesiTunggal: boolean) {
  if (terapkanSesiTunggal && (await peranSesiTunggal()).includes(user.role)) {
    // Login baru MENANG: perangkat lama dicabut. Perangkat lama langsung ditolak di request
    // berikutnya karena verifySession memeriksa baris ini (bukan menunggu token aksesnya habis).
    await prisma.userSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "LOGIN_PERANGKAT_LAIN" },
    });
  }
  const tokenSegar = randomBytes(32).toString("base64url");
  const row = await prisma.userSession.create({
    data: {
      userId: user.id, tokenHash: hashToken(tokenSegar), ingatSaya,
      userAgent: ringkasUA(info.userAgent), ip: info.ip, expiresAt: batasBaru(ingatSaya),
    },
  });
  const payload = payloadDari(user, row.id, null);
  return { sid: row.id, tokenSegar, payload, akses: await encrypt(payload) };
}

/** Login berhasil → buat sesi & pasang kedua cookie. Dipanggil dari server action login. */
export async function masukkanSesi(user: Identitas, ingatSaya: boolean) {
  const h = await headers();
  const hasil = await terbitkan(user, ingatSaya, { userAgent: h.get("user-agent"), ip: getClientIpFromHeaders(h) }, true);
  const c = await cookies();
  c.set(COOKIE_AKSES, hasil.akses, opsiCookieAkses(h));
  c.set(COOKIE_SEGAR, hasil.tokenSegar, opsiCookieSegar(ingatSaya, h));
  c.delete("impersonator");
  return hasil;
}

const pilihUser = { id: true, name: true, email: true, role: true, student: { select: { studentStatus: true } } } as const;

async function muatBaris(where: { tokenHash: string } | { id: string }) {
  return prisma.userSession.findUnique({ where, include: { user: { select: pilihUser } } });
}
type Baris = NonNullable<Awaited<ReturnType<typeof muatBaris>>>;

const masihBerlaku = (row: { revokedAt: Date | null; expiresAt: Date }) =>
  !row.revokedAt && row.expiresAt.getTime() > Date.now();

/** Siapa yang dipakai token akses: pemilik sesi, atau akun yang sedang ia "Masuki". */
async function identitasUntuk(row: Baris): Promise<{ identitas: Identitas; admin: Identitas | null } | null> {
  const st = row.user.student?.studentStatus;
  if (row.user.role === "STUDENT" && st && st !== "AKTIF") return null; // siswa keluar/lulus/pindah
  if (!row.impersonatingUserId) return { identitas: row.user, admin: null };
  const target = await prisma.user.findUnique({
    where: { id: row.impersonatingUserId }, select: { id: true, name: true, email: true, role: true },
  });
  // Pemilik sesi bukan ADMIN lagi / target hilang / target admin → akhiri Masuk Sebagai.
  if (row.user.role !== "ADMIN" || !target || target.role === "ADMIN") {
    await prisma.userSession.update({ where: { id: row.id }, data: { impersonatingUserId: null } });
    return { identitas: row.user, admin: null };
  }
  return { identitas: target, admin: row.user };
}

/** Token segar → token akses baru, sambil menggeser masa berlaku (sliding) dan mencatat aktivitas.
 *
 * SENGAJA TANPA ROTASI token segar. Halaman dashboard memuat banyak request paralel; kalau token
 * akses habis tepat saat itu, SEMUA request membawa token segar yang sama. Dengan rotasi, hanya satu
 * yang diterima dan sisanya ditolak → pengguna terlempar ke login padahal masih aktif — penyebab
 * klasik "logout sendiri". Pengamannya diganti: token segar tidak pernah keluar dari cookie HttpOnly,
 * hanya hash-nya di DB, dan setiap sesi bisa dicabut satu per satu. */
export async function segarkanSesi(tokenSegar: string, info: InfoPerangkat) {
  const row = await muatBaris({ tokenHash: hashToken(tokenSegar) });
  if (!row || !masihBerlaku(row)) return null;
  const id = await identitasUntuk(row);
  if (!id) {
    await cabutSesi({ id: row.id }, "AKUN_NONAKTIF");
    return null;
  }
  await prisma.userSession.update({
    where: { id: row.id },
    data: {
      lastSeenAt: new Date(), expiresAt: batasBaru(row.ingatSaya),
      ...(info.ip ? { ip: info.ip } : {}),
      ...(info.userAgent ? { userAgent: ringkasUA(info.userAgent) } : {}),
    },
  });
  const payload = payloadDari(id.identitas, row.id, id.admin);
  return { payload, akses: await encrypt(payload), ingatSaya: row.ingatSaya };
}

/** Versi baca-saja untuk verifySession — cadangan kalau token akses baru dari proxy tidak ikut
 * terbawa ke request (tidak menulis apa pun kecuali membersihkan Masuk Sebagai yang tidak sah). */
export async function bacaSesiDariTokenSegar(tokenSegar: string): Promise<SessionPayload | null> {
  const row = await muatBaris({ tokenHash: hashToken(tokenSegar) });
  if (!row || !masihBerlaku(row)) return null;
  const id = await identitasUntuk(row);
  return id ? payloadDari(id.identitas, row.id, id.admin) : null;
}

/** Sesi masih sah? Dipanggil verifySession di SETIAP halaman/API terlindungi (satu pencarian
 * primary key) — itulah yang membuat "keluar dari semua perangkat", sesi tunggal, dan cabut sesi
 * oleh admin langsung berlaku, bukan menunggu token akses 15 menit habis. */
export async function sesiMasihHidup(sid: string): Promise<boolean> {
  const row = await prisma.userSession.findUnique({ where: { id: sid }, select: { revokedAt: true, expiresAt: true } });
  return !!row && masihBerlaku(row);
}

export async function cabutSesi(where: { id: string } | { tokenHash: string }, alasan: string) {
  const r = await prisma.userSession.updateMany({
    where: { ...where, revokedAt: null },
    data: { revokedAt: new Date(), revokeReason: alasan },
  });
  return r.count;
}

export async function cabutSemuaSesiPengguna(userId: string, alasan: string, kecualiSid?: string | null) {
  const r = await prisma.userSession.updateMany({
    where: { userId, revokedAt: null, ...(kecualiSid ? { id: { not: kecualiSid } } : {}) },
    data: { revokedAt: new Date(), revokeReason: alasan },
  });
  return r.count;
}

/** Logout perangkat ini: cabut barisnya lalu hapus cookie. */
export async function keluarkanSesiIni() {
  const c = await cookies();
  const segar = c.get(COOKIE_SEGAR)?.value;
  const akses = await decrypt(c.get(COOKIE_AKSES)?.value);
  if (segar) await cabutSesi({ tokenHash: hashToken(segar) }, "LOGOUT").catch(() => 0);
  else if (akses?.sid) await cabutSesi({ id: akses.sid }, "LOGOUT").catch(() => 0);
  c.delete(COOKIE_AKSES);
  c.delete(COOKIE_SEGAR);
  c.delete("impersonator");
}

/* ─────────────────────── Masuk Sebagai (impersonasi) ─────────────────────── */

/** Sesi admin TETAP satu baris yang sama; yang berubah hanya `impersonatingUserId` + isi token
 * akses. Token segar milik admin tidak disentuh, jadi "kembali ke akun Admin" tidak butuh login. */
export async function mulaiMasukSebagai(admin: SessionPayload, target: Identitas) {
  if (!admin.sid) throw new Error("Sesi admin tidak dikenal.");
  await prisma.userSession.update({ where: { id: admin.sid }, data: { impersonatingUserId: target.id } });
  const payload = payloadDari(target, admin.sid, { id: admin.userId, name: admin.name, email: admin.email, role: admin.role });
  (await cookies()).set(COOKIE_AKSES, await encrypt(payload), opsiCookieAkses(await headers()));
}

export async function akhiriMasukSebagai(sekarang: SessionPayload): Promise<Identitas | null> {
  if (!sekarang.sid || !sekarang.imp) return null;
  const row = await prisma.userSession.update({
    where: { id: sekarang.sid },
    data: { impersonatingUserId: null },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  const payload = payloadDari(row.user, row.id, null);
  (await cookies()).set(COOKIE_AKSES, await encrypt(payload), opsiCookieAkses(await headers()));
  return row.user;
}

/* ─────────────────────── Migrasi token lama ─────────────────────── */

/** Token dari sistem lama (JWT 8 jam tanpa `sid`, plus cookie `impersonator` terpisah) diubah
 * menjadi sesi server baru TANPA memaksa login ulang. Tanpa ini, deploy sistem sesi baru akan
 * melempar semua orang yang sedang bekerja ke halaman login sekaligus. */
export async function migrasiTokenLama(lama: SessionPayload, impersonatorLama: SessionPayload | null, info: InfoPerangkat) {
  const pemilikId = impersonatorLama?.userId && impersonatorLama.userId !== lama.userId ? impersonatorLama.userId : lama.userId;
  const pemilik = await prisma.user.findUnique({ where: { id: pemilikId }, select: { id: true, name: true, email: true, role: true } });
  if (!pemilik) return null;
  const hasil = await terbitkan(pemilik, false, info, false);
  if (pemilikId === lama.userId || pemilik.role !== "ADMIN") return hasil;

  const target = await prisma.user.findUnique({ where: { id: lama.userId }, select: { id: true, name: true, email: true, role: true } });
  if (!target || target.role === "ADMIN") return hasil;
  await prisma.userSession.update({ where: { id: hasil.sid }, data: { impersonatingUserId: target.id } });
  const payload = payloadDari(target, hasil.sid, pemilik);
  return { ...hasil, payload, akses: await encrypt(payload) };
}
