import { bakuNamaSekolah } from "@/lib/nama-sekolah";
import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PASSWORD } from "@/lib/constants";
import { toProperCaseName } from "@/lib/text";
import { bacaIsiTahap } from "@/lib/spmb-tahapan";

/** KONVERSI SPMB → BUKU INDUK (17 Sep 2026). Format NIS & email sama dengan Buku Induk manual:
 * NIS `{urut_global}/{urut_jurusan}.{Major.nisCode}`, email = NIS tanpa simbol @smkalmunawwir.sch.id, sandi bawaan. */

/** Pilihan jurusan di formulir SPMB tersimpan sebagai "Nama (KODE)" — cocokkan ke Major. */
export function cocokJurusan<T extends { id: string; code: string; name: string }>(pilihan: string, jurusan: T[]): T | null {
  const kode = pilihan.match(/\(([^)]+)\)\s*$/)?.[1]?.trim().toLowerCase();
  const nama = pilihan.replace(/\([^)]*\)\s*$/, "").trim().toLowerCase();
  return jurusan.find(j => (kode && j.code.toLowerCase() === kode) || j.name.toLowerCase() === nama || j.code.toLowerCase() === pilihan.trim().toLowerCase()) ?? null;
}

/** Nomor urut terbesar saat ini (global & per jurusan) — dihitung sekali lalu dinaikkan per siswa dalam satu konversi. */
export async function penghitungNis() {
  const siswa = await prisma.student.findMany({ where: { nis: { contains: "/" } }, select: { nis: true, majorId: true } });
  let global = 0;
  const perJurusan = new Map<string, number>();
  for (const s of siswa) {
    const m = s.nis.match(/^(\d+)\/(\d+)\./);
    if (!m) continue;
    global = Math.max(global, parseInt(m[1], 10));
    perJurusan.set(s.majorId, Math.max(perJurusan.get(s.majorId) ?? 0, parseInt(m[2], 10)));
  }
  return {
    berikutnya(majorId: string, nisCode: string) {
      global += 1;
      const j = (perJurusan.get(majorId) ?? 0) + 1;
      perJurusan.set(majorId, j);
      return `${global}/${String(j).padStart(3, "0")}.${nisCode}`;
    },
  };
}

export const emailDariNis = (nis: string) => `${nis.replace(/[^a-zA-Z0-9]/g, "")}@smkalmunawwir.sch.id`;

export async function hashSandiBawaan() {
  return bcrypt.hash(DEFAULT_PASSWORD, 12);
}

export function dataSiswaDariPendaftar(a: {
  fullName: string; birthPlace: string | null; birthDate: Date; gender: string | null; nik: string | null; nisn: string | null;
  address: string | null; previousSchool: string | null; guardianName: string | null; phone: string; fotoUrl: string | null;
  pemeriksaan?: unknown;
}, tanggalDiterima: string, namaKelas?: string | null) {
  return {
    nama: toProperCaseName(a.fullName),
    siswa: {
      nisn: a.nisn || null,
      birthPlace: a.birthPlace || null,
      birthDate: a.birthDate,
      gender: a.gender === "L" || a.gender === "P" ? a.gender : a.gender || null,
      address: a.address || null,
      previousSchool: a.previousSchool ? bakuNamaSekolah(a.previousSchool) : null,
      bukuIndukData: {
        nik: a.nik ?? "", studentPhone: a.phone ?? "", guardianName: a.guardianName ? toProperCaseName(a.guardianName) : "",
        tingkatMasuk: "X (Sepuluh)", diterimaDate: tanggalDiterima,
        // Isian cek kesehatan SPMB yang ditandai `bukuInduk` (tinggi, berat, gol. darah, riwayat
        // penyakit) langsung mengisi grup "C. Kesehatan Siswa" — keputusan user 6 Okt 2026.
        ...Object.fromEntries(bacaIsiTahap(a.pemeriksaan).jawaban
          .filter(j => j.bukuInduk && j.nilai.trim() && j.nilai !== "Belum tahu").map(j => [j.bukuInduk!, j.nilai.trim()])),
        ...(namaKelas?.match(/(\d+)\s*$/) ? { rombel: namaKelas.match(/(\d+)\s*$/)![1] } : {}), ...(a.fotoUrl ? { fotoMasukUrl: a.fotoUrl } : {}),
      },
    },
  };
}
