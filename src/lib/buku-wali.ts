import "server-only";
import { prisma } from "@/lib/prisma";
import { hitungRisikoSiswa, levelPoin, semesterBerjalan } from "@/lib/peringatan-dini";
import { rentangSemester } from "@/lib/rapor-verifikasi";
import { susunRaporSiswa } from "@/lib/rapor-data";

/** BUKU WALI KELAS SATU HALAMAN (11 Oktober 2026) — per siswa: kehadiran, poin, nilai di bawah KKM, izin, ekskul, dan
 *  kunjungan rumah, yang sebelumnya tersebar di enam menu. HANYA MEMBACA dan memakai sumber yang sama dengan halamannya
 *  masing-masing, supaya angkanya tidak pernah berbeda:
 *   - kehadiran  = tabel Attendance dalam rentang semester berjalan (sama dengan rapor);
 *   - nilai      = `susunRaporSiswa` (nilai Jurnal Mengajar vs KKM per mapel) — bukan hitungan baru;
 *   - risiko     = `hitungRisikoSiswa` (Peringatan Dini);
 *   - poin       = StudentPointRecord semester berjalan, tingkat sanksi dari `levelPoin`;
 *   - kunjungan  = Rekam BK berjenis "Home Visit" (yang memang ditulis & dilihat wali kelas). Catatan BK LAIN hanya
 *                  JUMLAH-nya — isinya tetap di menu BK (aturan sama dengan Profil Siswa, CLAUDE.md #151). */
export interface BarisBukuWali {
  id: string; nama: string; nis: string; jk: string;
  hadir: { HADIR: number; IZIN: number; SAKIT: number; ALPHA: number; persen: number | null };
  poin: { bersih: number; level: string; pelanggaran: number; prestasi: number; daftar: { tanggal: string; jenis: string; nama: string; poin: number }[] };
  nilai: { mapel: number; dibawah: { mapel: string; nilai: number; kkm: number }[]; rata: number | null };
  izin: { menunggu: number; disetujui: number; daftar: { jenis: string; mulai: string; selesai: string; status: string; alasan: string }[] };
  ekskul: string[];
  kunjungan: { tanggal: string; catatan: string; status: string; oleh: string }[];
  catatanBk: number;
  risiko: { tingkat: string; alasan: string[] } | null;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export async function susunBukuWali(classId: string) {
  const semester = semesterBerjalan(), r = rentangSemester(semester);
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, grade: true, homeroom: { select: { userId: true, user: { select: { name: true } } } } } });
  if (!kelas) return null;
  const siswa = await prisma.student.findMany({
    where: { classId, studentStatus: "AKTIF" }, orderBy: { user: { name: "asc" } },
    select: {
      id: true, nis: true, gender: true, majorId: true, user: { select: { name: true } },
      attendance: { where: r ? { date: { gte: r.mulai, lt: r.akhir } } : {}, select: { status: true } },
      pointRecords: { where: { semester }, orderBy: { date: "desc" }, select: { kind: true, points: true, date: true, violationType: { select: { name: true } }, achievementType: { select: { name: true } } } },
      izinSiswa: { where: r ? { tanggalMulai: { gte: r.mulai, lt: r.akhir } } : {}, orderBy: { tanggalMulai: "desc" }, select: { jenis: true, tanggalMulai: true, tanggalSelesai: true, status: true, alasan: true } },
      extracurricular: { select: { extracurricular: { select: { name: true } } } },
      caseNotes: { orderBy: { date: "desc" }, select: { handlingType: true, note: true, status: true, date: true, handledByName: true } },
    },
  });
  const risiko = new Map((await hitungRisikoSiswa({ classIds: [classId] }).catch(() => ({ baris: [] }))).baris.map(b => [b.studentId, b]));
  const baris: BarisBukuWali[] = [];
  for (const s of siswa) {
    const n = (st: string) => s.attendance.filter(a => a.status === st).length;
    const jumlah = (k: string) => s.pointRecords.filter(p => p.kind === k).reduce((a, p) => a + p.points, 0);
    const bersih = Math.max(0, jumlah("PELANGGARAN") - jumlah("PRESTASI") - jumlah("REMISI"));
    // Nilai: semester berjalan dari sumber rapor. Gagal menghitung satu siswa tidak boleh menjatuhkan seluruh halaman.
    const rapor = (await susunRaporSiswa({ id: s.id, classId, majorId: s.majorId, grade: kelas.grade }).catch(() => [])).find(x => x.sem === semester);
    const bernilai = (rapor?.rows ?? []).filter(x => x.avg != null);
    const rs = risiko.get(s.id);
    baris.push({
      id: s.id, nama: s.user.name, nis: s.nis, jk: s.gender ?? "",
      hadir: { HADIR: n("HADIR"), IZIN: n("IZIN"), SAKIT: n("SAKIT"), ALPHA: n("ALPHA"), persen: s.attendance.length ? Math.round((n("HADIR") / s.attendance.length) * 100) : null },
      poin: {
        bersih, level: levelPoin(bersih), pelanggaran: jumlah("PELANGGARAN"), prestasi: jumlah("PRESTASI"),
        daftar: s.pointRecords.slice(0, 8).map(p => ({ tanggal: iso(p.date), jenis: p.kind, nama: p.violationType?.name ?? p.achievementType?.name ?? (p.kind === "REMISI" ? "Remisi" : "—"), poin: p.points })),
      },
      nilai: {
        mapel: bernilai.length, rata: rapor?.semAvg ?? null,
        dibawah: bernilai.filter(x => (x.avg as number) < x.kkm).map(x => ({ mapel: x.subject, nilai: Math.round((x.avg as number) * 10) / 10, kkm: x.kkm })),
      },
      izin: {
        menunggu: s.izinSiswa.filter(i => i.status === "MENUNGGU").length, disetujui: s.izinSiswa.filter(i => i.status === "DISETUJUI").length,
        daftar: s.izinSiswa.slice(0, 6).map(i => ({ jenis: i.jenis, mulai: iso(i.tanggalMulai), selesai: iso(i.tanggalSelesai), status: i.status, alasan: i.alasan.slice(0, 160) })),
      },
      ekskul: s.extracurricular.map(e => e.extracurricular.name).sort(),
      kunjungan: s.caseNotes.filter(c => c.handlingType === "Home Visit").slice(0, 5).map(c => ({ tanggal: iso(c.date), catatan: c.note.slice(0, 400), status: c.status, oleh: c.handledByName })),
      catatanBk: s.caseNotes.filter(c => c.handlingType !== "Home Visit").length,
      risiko: rs ? { tingkat: rs.tingkat, alasan: rs.alasan } : null,
    });
  }
  return { kelas: { id: kelas.id, nama: kelas.name, wali: kelas.homeroom?.user.name ?? null, waliUserId: kelas.homeroom?.userId ?? null }, semester, baris };
}

/** Kelas yang boleh dibuka: wali kelas → kelas walinya; Admin → semua kelas yang punya siswa aktif. */
export async function kelasBukuWali(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return prisma.class.findMany({ where: { students: { some: { studentStatus: "AKTIF" } } }, orderBy: [{ grade: "asc" }, { name: "asc" }], select: { id: true, name: true } });
  if (session.role !== "TEACHER") return [];
  const t = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { orderBy: { name: "asc" }, select: { id: true, name: true } } } });
  return t?.homeroomOf ?? [];
}
