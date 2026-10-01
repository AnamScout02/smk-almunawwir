import "server-only";
import { join } from "path";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { generateQrDataUrl } from "@/lib/qrcode";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";

/** IZIN KELUAR LINGKUNGAN SEKOLAH — dua wujud dari satu baris `IzinKeluarSiswa` (30 Sep 2026):
 *
 *  1. `perluFoto = false` → di portal siswa hanya **SURAT IZIN KELUAR**: kartu berisi identitas,
 *     alasan, jam keluar, rencana kembali, nama pencatat, dan QR keaslian. Ditunjukkan ke security
 *     atau ke tempat tujuan.
 *  2. `perluFoto = true` → surat yang sama PLUS kewajiban siswa mengunggah **bukti foto** dari
 *     tempat tujuan. Suratnya tetap berlaku (guru piket sudah mengizinkan); yang tertunda adalah
 *     buktinya, dan itu muncul di antrean "Perlu tindakan" siswa.
 *
 *  Bukti foto masuk FOLDER RAHASIA (bisa memuat informasi kesehatan, mis. izin ke klinik) dan hanya
 *  dibuka lewat `/api/izin-keluar/[id]/bukti`. */

export const FOLDER_BUKTI = join(process.cwd(), "public", "uploads", "rahasia", "izin-keluar");

/** Batas waktu siswa boleh mengunggah/mengganti bukti foto, dihitung dari jam keluar. */
export const JAM_BATAS_BUKTI = 24;

export const MIME_BUKTI: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export interface BarisIzinKeluar {
  keluarPada: Date;
  kembaliPada: Date | null;
  perluFoto: boolean;
  buktiFoto: string | null;
}

export type StatusIzinKeluar = "DI_LUAR" | "KEMBALI" | "BUKTI_TERTUNDA";

/** Satu sumber status untuk layar siswa, buku piket, dan halaman verifikasi — supaya ketiganya
 *  tidak pernah menyebut hal berbeda untuk baris yang sama. */
export function statusIzinKeluar(i: BarisIzinKeluar): StatusIzinKeluar {
  if (i.perluFoto && !i.buktiFoto) return "BUKTI_TERTUNDA";
  return i.kembaliPada ? "KEMBALI" : "DI_LUAR";
}

export const LABEL_STATUS: Record<StatusIzinKeluar, string> = {
  DI_LUAR: "Sedang di luar sekolah",
  KEMBALI: "Sudah kembali",
  BUKTI_TERTUNDA: "Bukti foto belum diunggah",
};

/** Masih boleh unggah/ganti bukti? */
export function bolehUnggahBukti(i: { keluarPada: Date; perluFoto: boolean }): boolean {
  if (!i.perluFoto) return false;
  return Date.now() - i.keluarPada.getTime() <= JAM_BATAS_BUKTI * 3600_000;
}

/** Boleh melihat bukti foto izin ini? Siswanya sendiri, orang tuanya, wali kelasnya,
 *  petugas piket/Kesiswaan/BK, pencatatnya, atau Admin. */
export async function bolehLihatBukti(
  session: { role: string; email: string; userId: string },
  izin: { studentId: string; dicatatId: string | null },
): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  if (izin.dicatatId && izin.dicatatId === session.userId) return true;
  if (session.role === "STUDENT") {
    const s = await prisma.student.findFirst({ where: { id: izin.studentId, user: { email: session.email } }, select: { id: true } });
    return !!s;
  }
  if (session.role === "PARENT") {
    const tautan = await prisma.parentStudent.findFirst({
      where: { studentId: izin.studentId, parent: { userId: session.userId } }, select: { id: true },
    });
    return !!tautan;
  }
  if (session.role === "TEACHER" || session.role === "TAS") {
    const [t, jabatan] = await Promise.all([
      prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } }),
      getJabatanNames(session.email),
    ]);
    if (jabatan.includes("Guru Piket") || KESISWAAN_BK_JABATAN.some(j => jabatan.includes(j))) return true;
    const kelasWali = t?.homeroomOf.map(c => c.id) ?? [];
    if (!kelasWali.length) return false;
    const s = await prisma.student.findUnique({ where: { id: izin.studentId }, select: { classId: true } });
    return !!s?.classId && kelasWali.includes(s.classId);
  }
  return false;
}

/** QR keaslian surat izin keluar (pola CLAUDE.md #49): token dibuat SEKALI per baris, jadi surat
 *  yang sudah ditunjukkan/di-screenshot siswa tetap terverifikasi setelah halaman dibuka ulang.
 *  Mengembalikan id izin → gambar QR (data URL). */
export async function qrIzinKeluar(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const baris = await prisma.izinKeluarSiswa.findMany({
    where: { id: { in: ids } }, select: { id: true, verifikasiToken: true },
  });
  const perlu = baris.filter(b => !b.verifikasiToken);
  for (const b of perlu) {
    // updateMany + syarat "masih null" supaya dua tab yang dibuka bersamaan tidak menimpa token.
    await prisma.izinKeluarSiswa.updateMany({
      where: { id: b.id, verifikasiToken: null },
      data: { verifikasiToken: randomBytes(18).toString("base64url") },
    });
  }
  const segar = perlu.length
    ? await prisma.izinKeluarSiswa.findMany({ where: { id: { in: ids } }, select: { id: true, verifikasiToken: true } })
    : baris;
  const hasil = await Promise.all(
    segar.filter(b => b.verifikasiToken)
      .map(async b => [b.id, await generateQrDataUrl(`${ALAMAT_APLIKASI}/verify/izin-keluar/${b.verifikasiToken}`)] as const),
  );
  return Object.fromEntries(hasil);
}
