import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

/** Cetak formulir pendaftaran yang SUDAH DIISI — untuk pendaftar sendiri maupun panitia
 *  (permintaan user 2 Oktober 2026). Satu sumber data & satu lembar cetak untuk keduanya. */

/** Tanda tangan ringkas pengganti tanggal lahir di alamat halaman cetak. Nilainya tetap (bukan
 *  kedaluwarsa) dan setara kuncinya dengan "nomor + tanggal lahir", tetapi TANGGAL LAHIR tidak ikut
 *  tertulis di URL — jadi tidak tertinggal di riwayat peramban komputer warnet/sekolah. */
export function tandaFormulir(nomor: string, lahirIso: string): string {
  const rahasia = process.env.SESSION_SECRET ?? "";
  return createHmac("sha256", rahasia).update(`formulir-spmb|${nomor.toUpperCase()}|${lahirIso}`).digest("base64url").slice(0, 32);
}

export function tandaCocok(nomor: string, lahirIso: string, tanda: string): boolean {
  const benar = Buffer.from(tandaFormulir(nomor, lahirIso));
  const diberi = Buffer.from(tanda ?? "");
  return benar.length === diberi.length && timingSafeEqual(benar, diberi);
}

const PILIH = {
  id: true, nomor: true, fullName: true, birthPlace: true, birthDate: true, gender: true,
  nik: true, nisn: true, phone: true, email: true, address: true, previousSchool: true,
  guardianName: true, chosenMajor: true, jalur: true, status: true, createdAt: true,
  ijazahUrl: true, kkUrl: true, ktpWaliUrl: true, fotoUrl: true, dokumenLainUrl: true,
  cetakToken: true,
  gelombang: { select: { nama: true, biayaDaftar: true } },
  berkasSpmb: { select: { id: true, berkas: true, diverifikasi: true, syarat: { select: { nama: true } } } },
} as const;

/** Mengambil satu pendaftar + memastikan token keaslian cetakannya ada (pola CLAUDE.md #49:
 *  token dibuat SEKALI, jadi cetak ulang memakai token yang sama). */
export async function ambilFormulir(where: { id: string } | { nomor: string }) {
  const baris = await prisma.admission.findUnique({ where: where as { id: string }, select: PILIH }).catch(() => null);
  if (!baris) return null;

  let token = baris.cetakToken;
  if (!token) {
    token = randomBytes(18).toString("base64url");
    // `updateMany` + syarat masih kosong: dua cetakan bersamaan tidak saling menimpa token.
    const n = await prisma.admission.updateMany({ where: { id: baris.id, cetakToken: null }, data: { cetakToken: token } });
    if (n.count === 0) {
      token = (await prisma.admission.findUnique({ where: { id: baris.id }, select: { cetakToken: true } }))?.cetakToken ?? null;
    }
  }
  const qr = token ? await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/formulir-spmb/${token}`).catch(() => "") : "";
  return { ...baris, cetakToken: token, qr };
}

export type DataFormulir = NonNullable<Awaited<ReturnType<typeof ambilFormulir>>>;

/** Tanggal lahir baris Admission dalam bentuk "YYYY-MM-DD" WIB — dipakai memeriksa tanda. */
export function lahirIso(d: Date): string {
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}
