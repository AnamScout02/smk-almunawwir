import "server-only";
import { prisma } from "@/lib/prisma";
import { pokokKurang } from "@/lib/induk-pokok";
import { fotoUntukKartu } from "@/lib/foto-kartu";
import { resolveExitDate } from "@/lib/student-exit";

/** PROFIL SISWA SATU HALAMAN (9 Okt 2026) — semua yang perlu TU tahu tentang SATU siswa, dari tabel yang sudah ada.
 *  Tidak ada data baru di sini. Catatan BK & kunjungan UKS hanya JUMLAH-nya: isinya tetap di halaman BK/UKS yang
 *  punya penjaganya sendiri (TU menjawab pertanyaan administrasi, bukan membaca catatan konseling/kesehatan). */
const WIB = 7 * 3600_000;
const ada = <T,>(p: Promise<T>, cadangan: T) => p.catch(() => cadangan);

export async function muatProfilSiswa(id: string) {
  const s = await prisma.student.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true, avatar: true } },
      class: { select: { name: true, grade: true, homeroom: { select: { user: { select: { name: true } } } } } },
      major: { select: { name: true, code: true } },
    },
  });
  if (!s) return null;
  const kini = new Date(Date.now() + WIB);
  const tahunTa = kini.getUTCMonth() >= 6 ? kini.getUTCFullYear() : kini.getUTCFullYear() - 1;
  const awalTa = new Date(Date.UTC(tahunTa, 6, 1) - WIB);

  const [absen, nilai, poin, pkl, izin, riwayatKelas, suratKet, legalisir, bantuan, rapor, ijazah, ekskul, pinjaman, uks, bk, tracer,
    spmb, ortu, pengajuan, perubahan] = await Promise.all([
    ada(prisma.attendance.findMany({ where: { studentId: id, date: { gte: awalTa } }, select: { date: true, status: true } }), []),
    ada(prisma.grade.findMany({ where: { studentId: id }, select: { subject: true, score: true, type: true, semester: true } }), []),
    ada(prisma.studentPointRecord.findMany({ where: { studentId: id }, orderBy: { date: "desc" }, select: { id: true, kind: true, points: true, note: true, date: true, violationType: { select: { name: true } }, achievementType: { select: { name: true } } } }), []),
    ada(prisma.internship.findUnique({ where: { studentId: id }, select: { company: true, mitraId: true, position: true, startDate: true, endDate: true, status: true, lamaBulan: true, nilaiAkhirRata: true, nilaiIndustriRata: true, laporanAkhirStatus: true, sertifikatNomor: true, teacher: { select: { user: { select: { name: true } } } }, _count: { select: { journal: true } } } }), null),
    ada(prisma.izinSiswa.findMany({ where: { studentId: id }, orderBy: { tanggalMulai: "desc" }, take: 5, select: { id: true, jenis: true, tanggalMulai: true, tanggalSelesai: true, status: true } }), []),
    ada(prisma.studentClassHistory.findMany({ where: { studentId: id }, orderBy: { createdAt: "asc" }, select: { id: true, className: true, grade: true, majorName: true, status: true, academicYear: { select: { name: true } } } }), []),
    ada(prisma.suratKeterangan.findMany({ where: { studentId: id }, orderBy: { tanggal: "desc" }, take: 8, select: { id: true, jenis: true, nomorSurat: true, tanggal: true, keperluan: true, requestStatus: true, suratId: true } }), []),
    ada(prisma.legalisirRequest.findMany({ where: { studentId: id }, orderBy: { requestDate: "desc" }, take: 5, select: { id: true, documentType: true, copies: true, requestDate: true, status: true } }), []),
    ada(prisma.bantuanSiswa.findMany({ where: { studentId: id }, orderBy: [{ tahun: "desc" }], take: 6, select: { id: true, jenis: true, tahun: true, tahap: true, nominal: true, statusAmbil: true } }), []),
    ada(prisma.raporHandover.findMany({ where: { studentId: id }, orderBy: { tanggalAmbil: "desc" }, take: 6, select: { id: true, semester: true, tanggalAmbil: true, diambilOleh: true } }), []),
    ada(prisma.ijazahHandover.findMany({ where: { studentId: id }, orderBy: { tanggalSerah: "desc" }, select: { id: true, dokumen: true, nomorIjazah: true, tanggalSerah: true, pengambilNama: true } }), []),
    ada(prisma.extracurricularMember.findMany({ where: { studentId: id }, select: { id: true, role: true, extracurricular: { select: { name: true } } } }), []),
    ada(prisma.bookLoan.findMany({ where: { borrowerId: s.userId, returnDate: null }, select: { id: true, dueDate: true, book: { select: { title: true } } } }), []),
    ada(prisma.uksVisit.count({ where: { studentId: id } }), 0),
    ada(prisma.studentCaseNote.count({ where: { studentId: id } }), 0),
    ada(prisma.alumniTracer.findUnique({ where: { studentId: id }, select: { status: true, institutionName: true, position: true, surveyDate: true } }), null),
    ada(prisma.admission.findFirst({ where: { studentId: id }, select: { nomor: true, ijazahUrl: true, kkUrl: true, ktpWaliUrl: true, fotoUrl: true, dokumenLainUrl: true, createdAt: true } }), null),
    ada(prisma.parentStudent.findMany({ where: { studentId: id }, select: { parent: { select: { user: { select: { name: true, email: true } } } } } }), []),
    ada(prisma.profileEditRequest.count({ where: { studentId: id, status: "PENDING" } }), 0),
    ada(prisma.activityLog.count({ where: { entity: "Student", entityId: id, action: "UPDATE_BUKU_INDUK" } }), 0),
  ]);

  const d = (s.bukuIndukData && typeof s.bukuIndukData === "object" ? s.bukuIndukData : {}) as Record<string, string>;
  const hitung = (st: string) => absen.filter(a => a.status === st).length;
  const rekapAbsen = { HADIR: hitung("HADIR"), IZIN: hitung("IZIN"), SAKIT: hitung("SAKIT"), ALPHA: hitung("ALPHA"), total: absen.length };
  // Per bulan (WIB), enam bulan terakhir yang ada catatannya.
  const perBulan = new Map<string, { HADIR: number; IZIN: number; SAKIT: number; ALPHA: number }>();
  for (const a of absen) {
    const w = new Date(a.date.getTime() + WIB), k = `${w.getUTCFullYear()}-${String(w.getUTCMonth() + 1).padStart(2, "0")}`;
    const b = perBulan.get(k) ?? { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 };
    if (a.status in b) b[a.status as keyof typeof b]++;
    perBulan.set(k, b);
  }
  // Nilai: ringkasan per semester × jenis (rata-rata & jumlah mapel) — rinciannya ada di rapor.
  const perSemester = new Map<string, { jenis: string; semester: string; jumlah: number; total: number; mapel: Set<string> }>();
  for (const n of nilai) {
    const k = `${n.semester}|${n.type}`, b = perSemester.get(k) ?? { jenis: n.type, semester: n.semester, jumlah: 0, total: 0, mapel: new Set<string>() };
    b.jumlah++; b.total += n.score; b.mapel.add(n.subject); perSemester.set(k, b);
  }
  const pelanggaran = poin.filter(p => p.kind === "PELANGGARAN"), prestasi = poin.filter(p => p.kind !== "PELANGGARAN");

  return {
    siswa: s, induk: d, tahunAjaran: `${tahunTa}/${tahunTa + 1}`,
    foto: fotoUntukKartu(s.bukuIndukData, s.user.avatar),
    kurang: pokokKurang(s), keluar: resolveExitDate(s),
    rekapAbsen, perBulan: [...perBulan.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6),
    nilai: [...perSemester.values()].map(v => ({ jenis: v.jenis, semester: v.semester, mapel: v.mapel.size, rata: Math.round((v.total / v.jumlah) * 10) / 10 }))
      .sort((a, b) => b.semester.localeCompare(a.semester) || a.jenis.localeCompare(b.jenis)),
    poinPelanggaran: pelanggaran.reduce((a, p) => a + p.points, 0), poinPrestasi: prestasi.reduce((a, p) => a + p.points, 0),
    poin: poin.slice(0, 6).map(p => ({ id: p.id, pelanggaran: p.kind === "PELANGGARAN", nama: p.violationType?.name ?? p.achievementType?.name ?? p.note ?? "—", poin: p.points, tanggal: p.date })),
    jumlahPoin: poin.length,
    pkl, izin, riwayatKelas, suratKet, legalisir, bantuan, rapor, ijazah, ekskul, pinjaman, uks, bk, tracer, spmb,
    ortu: ortu.map(o => o.parent.user), pengajuan, perubahan,
  };
}
export type ProfilSiswa = NonNullable<Awaited<ReturnType<typeof muatProfilSiswa>>>;
