import "server-only";
import { generateSecret, generateURI, verify } from "otplib";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const ISSUER = "SMK Al-Munawwir IIBS";

/** Autentikasi Dua Faktor (TOTP) — KHUSUS akun ADMIN (lihat login()/verifyLoginTotp() di
 * auth.ts). Mitigasi risiko fitur impersonasi: satu akun admin dibobol = seluruh sistem bisa
 * "dijelajahi sebagai siapa saja", jadi lapis tambahan ini dibatasi ke role paling berprivilege,
 * bukan wajib untuk semua role (guru/siswa/ortu tidak perlu — beban UX tidak sepadan risikonya). */

export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpKeyUri(email: string, secret: string): string {
  return generateURI({ issuer: ISSUER, label: email, secret });
}

export async function verifyTotpToken(token: string, secret: string): Promise<boolean> {
  try {
    const result = await verify({ secret, token: token.trim() });
    return result.valid;
  } catch {
    return false;
  }
}

/** Kode cadangan sekali-pakai (dipakai kalau HP hilang/authenticator app tidak bisa diakses) —
 * ditampilkan SATU KALI ke admin saat 2FA diaktifkan, disimpan sebagai hash (bukan plaintext). */
export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})(.{5})/, "$1-$2")
  );
}

export async function hashBackupCodes(codes: string[]): Promise<string[]> {
  return Promise.all(codes.map(c => bcrypt.hash(c, 10)));
}

/** Cek + "bakar" (hapus) satu kode cadangan kalau cocok — sekali pakai, tidak bisa dipakai ulang. */
export async function consumeBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { totpBackupCodes: true } });
  if (!user) return false;
  const normalized = code.trim().toUpperCase();
  for (const hash of user.totpBackupCodes) {
    if (await bcrypt.compare(normalized, hash)) {
      await prisma.user.update({
        where: { id: userId },
        data: { totpBackupCodes: user.totpBackupCodes.filter(h => h !== hash) },
      });
      return true;
    }
  }
  return false;
}
