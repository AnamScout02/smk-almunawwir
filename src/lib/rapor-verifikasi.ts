import "server-only";
import { prisma } from "@/lib/prisma";
import { bagianWib } from "@/lib/waktu-wib";

/** VERIFIKASI BERTINGKAT RAPOR (17 Sep 2026 — permintaan user: "wali kelas mengunci, kepala sekolah menyetujui, baru rapor bisa
 * dicetak"). Tahap 1: wali kelas mengunci nilai kelasnya per semester (`RaporKunci`). Tahap 2: kepala sekolah mengesahkan
 * (`RaporApproval`) — hanya bisa setelah terkunci. Rapor siswa/orang tua tampil & bisa dicetak setelah tahap 2.
 * Selama terkunci, nilai jurnal kelas+semester itu tidak bisa diubah (simpan jurnal & impor Excel ditolak). Membuka kunci hanya
 * bisa bila belum disahkan. */

/** Empat semester (tahun ajaran lalu & sekarang), dihitung di WIB. Format "Ganjil 2026/2027". */
export function semesterRapor(): string[] {
  const { tahun, bulan } = bagianWib();
  const kini = bulan >= 7 ? `${tahun}/${tahun + 1}` : `${tahun - 1}/${tahun}`;
  const lalu = bulan >= 7 ? `${tahun - 1}/${tahun}` : `${tahun - 2}/${tahun - 1}`;
  return [`Ganjil ${lalu}`, `Genap ${lalu}`, `Ganjil ${kini}`, `Genap ${kini}`];
}

/** Rentang tanggal semester (UTC, tanggal kalender): Ganjil = Juli–Desember tahun pertama, Genap = Januari–Juni tahun kedua. */
export function rentangSemester(semester: string): { mulai: Date; akhir: Date } | null {
  const m = /^(Ganjil|Genap)\s+(\d{4})\/(\d{4})$/.exec(semester.trim());
  if (!m) return null;
  const [, jenis, a, b] = m;
  return jenis === "Ganjil"
    ? { mulai: new Date(Date.UTC(Number(a), 6, 1)), akhir: new Date(Date.UTC(Number(a) + 1, 0, 1)) }
    : { mulai: new Date(Date.UTC(Number(b), 0, 1)), akhir: new Date(Date.UTC(Number(b), 6, 1)) };
}

/** Pesan penolakan bila nilai kelas pada salah satu semester sudah dikunci wali kelas; null bila masih terbuka. */
export async function pesanNilaiTerkunci(classId: string, semesters: string[]): Promise<string | null> {
  const unik = [...new Set(semesters.filter(Boolean))];
  if (!classId || !unik.length) return null;
  const k = await prisma.raporKunci.findFirst({ where: { classId, semester: { in: unik } }, select: { semester: true, lockedBy: true } });
  return k ? `Nilai kelas ini untuk semester ${k.semester} sudah dikunci wali kelas (${k.lockedBy}) untuk rapor. Minta wali kelas membuka kuncinya dulu.` : null;
}
