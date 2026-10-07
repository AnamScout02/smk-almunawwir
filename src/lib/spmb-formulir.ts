import "server-only";
import { randomBytes } from "crypto";
// Tanda & tanggal lahir dipisah ke spmb-tanda.ts supaya modul yang ikut instrumentation (pengingat) tidak
// menarik qrcode.ts (fs/path) ke runtime Edge. Diekspor ulang di sini untuk pemanggil lama.
export { tandaFormulir, tandaCocok, lahirIso } from "@/lib/spmb-tanda";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

/** Cetak formulir pendaftaran yang SUDAH DIISI — untuk pendaftar sendiri maupun panitia
 *  (permintaan user 2 Oktober 2026). Satu sumber data & satu lembar cetak untuk keduanya. */

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

