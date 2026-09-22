import "server-only";
import { resolveExitDate } from "@/lib/student-exit";
import { prisma } from "@/lib/prisma";

/** Status satu SETENGAH kolom tingkat (tahun atas / tahun bawah).
 * - "isi"    : siswa memang bersekolah di sini pada tahun itu -> tahunnya ditulis
 * - "arsir"  : siswa sudah keluar sebelum tahun itu -> kotaknya diarsir (tahun tidak ditulis)
 * - "kosong" : siswa masih aktif tapi belum sampai tahun itu -> dibiarkan polos, nanti terisi
 *              sendiri seiring naik kelas (keputusan user 2026-09-12) */
export type HalfState = "isi" | "arsir" | "kosong";

/** Satu kolom tingkat di buku fisik = SATU kotak yang dibagi dua baris: tahun awal di atas,
 * tahun akhir di bawah (ditulis seperti pecahan, mis. 2025 di atas / 2026 di bawah).
 * Pembagian ini penting karena siswa bisa keluar DI TENGAH tahun ajaran — contoh nyata dari user:
 * Dela keluar Oktober 2025 saat kelas XI, jadi di kolom XI "2025" ditulis tapi "2026" diarsir. */
export interface GradeYear {
  top: number | null;
  bottom: number | null;
  topState: HalfState;
  bottomState: HalfState;
}

export interface KlapperRow {
  id: string;
  name: string;
  nomorInduk: string;      // NIS — di buku fisik kolomnya bernama "Nomor Induk"
  nisn: string | null;
  majorCode: string;
  majorName: string;
  enrollYear: number | null;
  gradeX: GradeYear;
  gradeXI: GradeYear;
  gradeXII: GradeYear;
  keluar: boolean;
  keterangan: string;
  status: string;
}

/** Keterangan SENGAJA dibuat sesingkat buku fisik: hanya "Mutasi Masuk" / "Mutasi Keluar",
 * TANPA nama sekolah tujuan/asal dan tanpa tahun (keputusan eksplisit user 2026-09-12: "cukup
 * mutasi masuk dan mutasi keluar saja keterangannya, jangan sekolah tujuan/asal"). Tahun keluar
 * sudah tergambar sendiri lewat arsiran di kolom tingkat, jadi tidak perlu diulang di sini.
 * Siswa normal & lulus dibiarkan KOSONG, sama seperti di buku. */
function buildKeterangan(status: string, pindahanDari: string | null): string {
  const parts: string[] = [];
  if (pindahanDari) parts.push("Mutasi Masuk");
  if (status === "KELUAR" || status === "PINDAH") parts.push("Mutasi Keluar");
  return parts.join(", ");
}

/** Tahun ajaran nama "2025/2026" -> 2025. */
function parseAjaranStart(name: string): number | null {
  const n = parseInt(name.split("/")[0]?.trim() ?? "", 10);
  return Number.isFinite(n) ? n : null;
}

export async function getKlapperRows(): Promise<KlapperRow[]> {
  const [students, histories] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true, nis: true, nisn: true, enrollYear: true, studentStatus: true, exitDate: true,
        bukuIndukData: true,
        user: { select: { name: true } },
        class: { select: { grade: true } },
        major: { select: { code: true, name: true } },
      },
      orderBy: { user: { name: "asc" } },
    }),
    prisma.studentClassHistory.findMany({
      select: { studentId: true, grade: true, academicYear: { select: { name: true } } },
    }),
  ]);

  const histByStudent = new Map<string, Map<number, string>>();
  for (const h of histories) {
    if (h.grade == null) continue;
    if (!histByStudent.has(h.studentId)) histByStudent.set(h.studentId, new Map());
    histByStudent.get(h.studentId)!.set(h.grade, h.academicYear.name);
  }

  return students.map(s => {
    const status = s.studentStatus ?? "AKTIF";
    const keluar = status === "KELUAR" || status === "PINDAH";
    const hist = histByStudent.get(s.id);
    const bid = (s.bukuIndukData ?? {}) as Record<string, unknown>;
    // Nilai "-" / "–" / "0" dipakai sbg penanda KOSONG di file Buku Induk sekolah (bukan data
    // sungguhan). Kalau diperlakukan sebagai isi, 231 alumni jadi salah ditandai "Mutasi Masuk"
    // hanya karena kolom "Pindahan Dari"-nya diisi strip (ketahuan saat impor alumni 2026-09-12).
    const str = (k: string) => {
      const v = typeof bid[k] === "string" ? (bid[k] as string).trim() : "";
      return v && !/^[-–—0]+$/.test(v) ? v : null;
    };

    // Tanggal keluar dipakai bersama Buku Mutasi lewat resolveExitDate() — SATU aturan untuk dua
    // buku, supaya tidak terulang kejadian keduanya membaca sumber berbeda lalu tidak sinkron
    // (Buku Mutasi dulu hanya membaca kolom Student.exitDate yang kosong semua, sementara Klapper
    // membaca bukuIndukData.pindahDate yang terisi — temuan audit 2026-09-12).
    // Catatan: cabang LULUS di bawah dievaluasi LEBIH DULU, jadi fallback ke tanggal lulus di
    // dalam resolveExitDate tidak pernah salah dibaca sebagai "keluar".
    const exitDate = resolveExitDate(s);

    // Tingkat siswa AKTIF diambil dari kelasnya sekarang. Untuk siswa MUTASI, class.grade TIDAK
    // BOLEH dipakai: baris Class dipakai ulang tiap tahun & ikut naik tingkat lewat kenaikan
    // kelas, sedangkan siswa yang keluar tidak pernah dilepas dari kelasnya — akibatnya siswa
    // yang keluar waktu kelas X pun "menempel" di kelas yang kini sudah XII (temuan user
    // 2026-09-12 lewat kasus Dela Nur Aulia: 23 dari 28 siswa mutasi tercatat di kelas XII).
    const activeGrade = s.class?.grade ?? null;

    const yearFor = (grade: number): GradeYear => {
      const fromHist = hist?.get(grade);
      const top = fromHist ? parseAjaranStart(fromHist)
        : s.enrollYear != null ? s.enrollYear + (grade - 10)
          : null;
      if (top == null) return { top: null, bottom: null, topState: "kosong", bottomState: "kosong" };
      const bottom = top + 1;

      if (status === "LULUS") return { top, bottom, topState: "isi", bottomState: "isi" };

      if (keluar) {
        if (!exitDate) {
          // Tanggal keluar tidak tercatat — jangan mengarang sampai kapan dia bertahan; anggap
          // hanya sempat di tingkat X, sisanya diarsir.
          const isi = grade === 10;
          return { top, bottom, topState: isi ? "isi" : "arsir", bottomState: isi ? "isi" : "arsir" };
        }
        // Setengah ATAS mewakili Juli–Desember tahun `top`; setengah BAWAH Januari–Juni tahun
        // `bottom`. Sebuah setengah "isi" kalau siswa masih di sekolah saat periode itu MULAI.
        const topStart = new Date(top, 6, 1);       // 1 Juli tahun atas
        const bottomStart = new Date(bottom, 0, 1); // 1 Januari tahun bawah
        return {
          top, bottom,
          topState: exitDate >= topStart ? "isi" : "arsir",
          bottomState: exitDate >= bottomStart ? "isi" : "arsir",
        };
      }

      // Masih aktif: terisi sampai tingkat yang sedang/atau sudah dijalani; tingkat di atasnya
      // dibiarkan KOSONG (bukan diarsir) karena nanti terisi sendiri waktu naik kelas.
      const reached = fromHist != null || (activeGrade != null && grade <= activeGrade);
      return reached
        ? { top, bottom, topState: "isi", bottomState: "isi" }
        : { top, bottom, topState: "kosong", bottomState: "kosong" };
    };

    return {
      id: s.id,
      name: s.user.name,
      nomorInduk: s.nis,
      nisn: s.nisn,
      majorCode: s.major.code,
      majorName: s.major.name,
      enrollYear: s.enrollYear,
      gradeX: yearFor(10),
      gradeXI: yearFor(11),
      gradeXII: yearFor(12),
      keluar,
      keterangan: buildKeterangan(status, str("pindahanDari")),
      status,
    };
  });
}

/** Huruf awal untuk pengelompokan — nama berawalan angka/simbol masuk ke "#". */
export function letterOf(name: string): string {
  const c = (name.trim()[0] ?? "#").toUpperCase();
  return c >= "A" && c <= "Z" ? c : "#";
}

function indukNumber(nomorInduk: string): number {
  const n = parseInt(nomorInduk.split("/")[0]?.replace(/\D/g, "") ?? "", 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

/** Urutan baris DI DALAM satu huruf. Buku fisik memakai "induk": tiap ada siswa baru berhuruf itu,
 * dia ditambahkan di baris berikutnya — jadi urutannya kronologis masuk sekolah, BUKAN abjad
 * (terverifikasi dari foto buku asli: nomor induk 015, 036, 032, 072, 049, ... di halaman "N").
 * "abjad" disediakan karena di versi digital (yang punya kotak cari) urutan nama lebih enak
 * dipakai untuk menelusuri manual. */
export type KlapperSort = "abjad" | "induk";

export function sortKlapper(rows: KlapperRow[], mode: KlapperSort): KlapperRow[] {
  const out = [...rows];
  if (mode === "induk") {
    out.sort((a, b) =>
      (a.enrollYear ?? 9999) - (b.enrollYear ?? 9999) ||
      indukNumber(a.nomorInduk) - indukNumber(b.nomorInduk) ||
      a.name.localeCompare(b.name, "id"));
  } else {
    out.sort((a, b) => a.name.localeCompare(b.name, "id"));
  }
  return out;
}
