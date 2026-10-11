import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { pekanKini } from "@/lib/jurnal-cepat";
import { susunKeterlaksanaan } from "@/lib/keterlaksanaan";

/** BUKTI AKREDITASI OTOMATIS (10 Oktober 2026, pilihan user) — tiap butir ditautkan ke DATA yang sudah ada di situs:
 *  jumlahnya dihitung saat halaman dibuka dan tiap sumber punya tautan ke halamannya, jadi saat visitasi cukup membuka
 *  satu butir. Tidak ada unggahan/isian bukti baru — dokumen di luar situs cukup ditautkan (Arsip, Drive).
 *
 *  YANG SENGAJA TIDAK DILAKUKAN: menulis teks butir instrumen resmi di kode. Instrumen berganti (IASP 2020 → instrumen
 *  BAN-PDM) dan rumusannya milik lembaga akreditasi; daftar bawaan di bawah hanyalah PENGELOMPOKAN BUKTI untuk memulai.
 *  Penjamin Mutu menyesuaikan kode, judul, dan sumber tiap butir dengan instrumen yang dipakai asesor (disimpan di
 *  SiteSetting `mutu.butirAkreditasi`). Sumber baru = tambah satu baris di `KATALOG`. */

export interface ButirAkreditasi { id: string; kode: string; kelompok: string; judul: string; uraian: string; sumber: string[]; tautan: { label: string; url: string }[]; catatan: string }
export interface SumberBukti { kunci: string; label: string; satuan: string; admin: string | null; guru: string | null }
interface Konteks { awalTA: Date; awalSem: Date; semLabel: string; tahunAjaran: string; semester: string }
type Penghitung = (k: Konteks) => Promise<number>;

const A = "/dashboard/admin", G = "/dashboard/teacher";
const KATALOG: (SumberBukti & { hitung: Penghitung })[] = [
  { kunci: "kalender", label: "Kalender Pendidikan", satuan: "agenda tahun ajaran ini", admin: `${A}/kalender-pendidikan`, guru: null, hitung: k => prisma.schoolEvent.count({ where: { tanggalMulai: { gte: k.awalTA } } }) },
  { kunci: "jadwal", label: "Jadwal Pelajaran", satuan: "slot jadwal", admin: `${A}/schedules`, guru: null, hitung: () => prisma.schedule.count({ where: { scheduleType: "BLOK" } }) },
  { kunci: "penugasan", label: "Penugasan Mengajar", satuan: "penugasan guru × kelas × mapel", admin: `${A}/teaching-assignments`, guru: null, hitung: () => prisma.teachingAssignment.count() },
  { kunci: "prota", label: "Prota & Promes", satuan: "dokumen semester ini", admin: `${A}/kelengkapan-perangkat`, guru: `${G}/kelengkapan-perangkat`, hitung: k => prisma.rencanaAjar.count({ where: { tahunAjaran: k.tahunAjaran, semester: k.semester } }) },
  { kunci: "rpp", label: "RPP / Modul Ajar", satuan: "dokumen", admin: `${A}/rpp`, guru: `${G}/rpp`, hitung: () => prisma.lessonPlan.count() },
  { kunci: "jurnal", label: "Jurnal Mengajar", satuan: "pertemuan dijurnal semester ini", admin: `${A}/jurnal-guru`, guru: `${G}/keterlaksanaan`, hitung: k => prisma.teachingJournal.count({ where: { date: { gte: k.awalSem } } }) },
  { kunci: "keterlaksanaan", label: "Keterlaksanaan Kurikulum", satuan: "% pertemuan dijurnal", admin: `${A}/keterlaksanaan`, guru: `${G}/keterlaksanaan`, hitung: async () => { const h = await susunKeterlaksanaan(); const p = h.baris.reduce((t, b) => t + b.pertemuan, 0), j = h.baris.reduce((t, b) => t + Math.min(b.jurnal, b.pertemuan || b.jurnal), 0); return p ? Math.round((j / p) * 100) : 0; } },
  { kunci: "formNilai", label: "Form Nilai Rapor", satuan: "form terkirim semester ini", admin: `${A}/form-nilai-rapor`, guru: `${G}/form-nilai-rapor`, hitung: k => prisma.formNilaiRapor.count({ where: { semester: k.semLabel, status: "DIKIRIM" } }) },
  { kunci: "rapor", label: "Pengesahan Rapor", satuan: "kelas disahkan", admin: `${A}/pengesahan-rapor`, guru: null, hitung: () => prisma.raporApproval.count() },
  { kunci: "ujian", label: "Ujian (CBT) & Kisi-kisi", satuan: "ujian tahun ajaran ini", admin: "/pusat-ujian", guru: "/pusat-ujian", hitung: k => prisma.exam.count({ where: { startTime: { gte: k.awalTA } } }) },
  { kunci: "analisisButir", label: "Analisis Butir Soal", satuan: "pengerjaan terkumpul", admin: "/pusat-ujian/analisis-butir", guru: "/pusat-ujian/analisis-butir", hitung: k => prisma.examAttempt.count({ where: { submittedAt: { gte: k.awalTA } } }) },
  { kunci: "remedial", label: "Rekap Nilai Ujian", satuan: "ujian terbit", admin: "/pusat-ujian/rekap-nilai", guru: "/pusat-ujian/rekap-nilai", hitung: k => prisma.exam.count({ where: { startTime: { gte: k.awalTA }, isPublished: true } }) },
  { kunci: "supervisi", label: "Supervisi & PKG", satuan: "supervisi tahun ajaran ini", admin: `${A}/supervisi`, guru: `${G}/supervisi`, hitung: k => prisma.supervisiGuru.count({ where: { tanggal: { gte: k.awalTA } } }) },
  { kunci: "pkb", label: "Portofolio PKB Guru", satuan: "kegiatan tahun ajaran ini", admin: `${A}/pkb`, guru: `${G}/pkb`, hitung: k => prisma.pkbGuru.count({ where: { mulai: { gte: k.awalTA } } }) },
  { kunci: "raporKinerja", label: "Rapor Kinerja Guru", satuan: "guru aktif", admin: `${A}/rapor-kinerja`, guru: `${G}/rapor-kinerja`, hitung: () => prisma.teacher.count({ where: { OR: [{ teacherStatus: null }, { teacherStatus: "AKTIF" }], user: { role: "TEACHER" } } }) },
  { kunci: "presensiPegawai", label: "Presensi Pegawai", satuan: "catatan tahun ajaran ini", admin: `${A}/presensi-pegawai`, guru: null, hitung: k => prisma.staffAttendance.count({ where: { tanggal: { gte: k.awalTA } } }) },
  { kunci: "kehadiranGuru", label: "Kehadiran Guru di Kelas (Buku Piket)", satuan: "jam dicatat piket", admin: `${A}/kehadiran-guru`, guru: null, hitung: k => prisma.teacherScheduleAttendance.count({ where: { date: { gte: k.awalTA } } }) },
  { kunci: "kpi", label: "Kinerja Pimpinan (KPI)", satuan: "bukti kinerja dikirim", admin: `${A}/kinerja-pimpinan`, guru: null, hitung: () => prisma.kpiSubmission.count() },
  { kunci: "programKerja", label: "Program Kerja", satuan: "program", admin: `${A}/program-kerja`, guru: `${G}/program-kerja`, hitung: () => prisma.programKerja.count() },
  { kunci: "notulen", label: "Notulen Rapat", satuan: "notulen", admin: `${A}/notulen-rapat`, guru: null, hitung: () => prisma.meetingMinutes.count() },
  { kunci: "survei", label: "Survei & Angket", satuan: "jawaban masuk", admin: `${A}/survei`, guru: `${G}/survei`, hitung: () => prisma.surveiRespons.count() },
  { kunci: "absensiSiswa", label: "Absensi Siswa", satuan: "catatan tahun ajaran ini", admin: `${A}/absensi-siswa`, guru: null, hitung: k => prisma.attendance.count({ where: { date: { gte: k.awalTA } } }) },
  { kunci: "bk", label: "Layanan BK", satuan: "catatan layanan (jumlah saja)", admin: `${A}/rekam-bk`, guru: null, hitung: () => prisma.studentCaseNote.count() },
  { kunci: "poin", label: "Poin & Prestasi Siswa", satuan: "catatan poin", admin: `${A}/poin-siswa`, guru: null, hitung: k => prisma.studentPointRecord.count({ where: { createdAt: { gte: k.awalTA } } }) },
  { kunci: "tataTertib", label: "Tata Tertib", satuan: "jenis pelanggaran diatur", admin: `${A}/tata-tertib`, guru: `${G}/tata-tertib`, hitung: () => prisma.studentViolationType.count() },
  { kunci: "ekstra", label: "Ekstrakurikuler", satuan: "ekstrakurikuler", admin: "/pusat-ekstra", guru: "/pusat-ekstra", hitung: () => prisma.extracurricular.count() },
  { kunci: "uks", label: "UKS", satuan: "kunjungan tahun ajaran ini (jumlah saja)", admin: `${A}/uks`, guru: null, hitung: k => prisma.uksVisit.count({ where: { createdAt: { gte: k.awalTA } } }) },
  { kunci: "perpustakaan", label: "Perpustakaan", satuan: "judul buku", admin: "/pusat-perpustakaan", guru: null, hitung: () => prisma.book.count() },
  { kunci: "aset", label: "Inventaris Sarana Prasarana", satuan: "aset tercatat", admin: `${A}/inventaris`, guru: null, hitung: () => prisma.asset.count() },
  { kunci: "perawatan", label: "Perawatan Sarana", satuan: "riwayat perawatan", admin: `${A}/sarpras/perawatan`, guru: null, hitung: () => prisma.riwayatPerawatan.count() },
  { kunci: "pkl", label: "Praktik Kerja Lapangan", satuan: "siswa ditempatkan", admin: "/pusat-pkl", guru: null, hitung: () => prisma.internship.count({ where: { mitraId: { not: null } } }) },
  { kunci: "dudi", label: "Mitra DUDI & MoU", satuan: "mitra aktif", admin: "/pusat-pkl/dudi", guru: null, hitung: () => prisma.industryPartner.count({ where: { aktif: true } }) },
  { kunci: "tracer", label: "Tracer Study Alumni", satuan: "alumni mengisi", admin: `${A}/tracer-study`, guru: null, hitung: () => prisma.alumniTracer.count() },
  { kunci: "spmb", label: "Penerimaan Murid Baru", satuan: "pendaftar tahun ajaran ini", admin: "/pusat-spmb", guru: null, hitung: k => prisma.admission.count({ where: { createdAt: { gte: k.awalTA } } }) },
  { kunci: "pengumuman", label: "Pengumuman ke Warga Sekolah", satuan: "pengumuman tahun ajaran ini", admin: `${A}/pengumuman`, guru: null, hitung: k => prisma.announcement.count({ where: { createdAt: { gte: k.awalTA } } }) },
  { kunci: "arsip", label: "E-Arsip Dokumen", satuan: "dokumen", admin: `${A}/arsip`, guru: null, hitung: () => prisma.arsip.count() },
  { kunci: "sk", label: "Arsip SK & Dokumen Kepegawaian", satuan: "dokumen", admin: `${A}/arsip-sk`, guru: null, hitung: () => prisma.arsipSk.count() },
  { kunci: "surat", label: "Agenda Surat", satuan: "surat tahun ajaran ini", admin: `${A}/persuratan`, guru: null, hitung: k => prisma.surat.count({ where: { createdAt: { gte: k.awalTA } } }) },
  { kunci: "alokasiDana", label: "Alokasi Dana", satuan: "rencana", admin: `${A}/alokasi-dana`, guru: null, hitung: () => prisma.alokasiRencana.count() },
];
const KUNCI_SAH = new Set(KATALOG.map(k => k.kunci));
export const KUNCI_BUTIR = "mutu.butirAkreditasi";

const B = (kode: string, kelompok: string, judul: string, uraian: string, sumber: string[]): ButirAkreditasi => ({ id: `awal-${kode}`, kode, kelompok, judul, uraian, sumber, tautan: [], catatan: "" });
/** Pengelompokan bukti untuk MEMULAI — bukan teks instrumen resmi (lihat catatan di atas). */
const BAWAAN: ButirAkreditasi[] = [
  B("P1", "Proses Pembelajaran", "Perencanaan pembelajaran", "Kalender, jadwal, pembagian tugas, dan perangkat ajar guru.", ["kalender", "jadwal", "penugasan", "prota", "rpp"]),
  B("P2", "Proses Pembelajaran", "Pelaksanaan pembelajaran", "Bukti pembelajaran berjalan sesuai jadwal dan rencana.", ["jurnal", "keterlaksanaan", "kehadiranGuru", "absensiSiswa"]),
  B("P3", "Proses Pembelajaran", "Penilaian hasil belajar", "Ujian, kisi-kisi, analisis butir, dan pengolahan nilai rapor.", ["ujian", "analisisButir", "remedial", "formNilai", "rapor"]),
  B("G1", "Guru & Tenaga Kependidikan", "Supervisi dan penilaian kinerja", "Supervisi kelas, rapor kinerja, dan kinerja pimpinan.", ["supervisi", "raporKinerja", "kpi"]),
  B("G2", "Guru & Tenaga Kependidikan", "Pengembangan keprofesian", "Pelatihan, diklat, dan kegiatan pengembangan guru.", ["pkb", "sk"]),
  B("G3", "Guru & Tenaga Kependidikan", "Kedisiplinan pegawai", "Presensi pegawai dan kehadiran guru di kelas.", ["presensiPegawai", "kehadiranGuru"]),
  B("L1", "Lulusan & Layanan Siswa", "Pembinaan karakter dan kedisiplinan siswa", "Tata tertib, poin, layanan BK, dan kesehatan.", ["tataTertib", "poin", "bk", "uks"]),
  B("L2", "Lulusan & Layanan Siswa", "Pengembangan bakat dan minat", "Ekstrakurikuler dan prestasi siswa.", ["ekstra", "poin"]),
  B("L3", "Lulusan & Layanan Siswa", "Keterserapan lulusan", "Penelusuran alumni dan penyaluran kerja.", ["tracer"]),
  B("M1", "Pengelolaan Sekolah", "Perencanaan dan evaluasi program", "Program kerja, rapat, dan survei kepuasan.", ["programKerja", "notulen", "survei", "alokasiDana"]),
  B("M2", "Pengelolaan Sekolah", "Administrasi dan kearsipan", "Persuratan, arsip dokumen, dan komunikasi ke warga sekolah.", ["surat", "arsip", "pengumuman"]),
  B("M3", "Pengelolaan Sekolah", "Sarana dan prasarana", "Inventaris, perawatan, dan perpustakaan.", ["aset", "perawatan", "perpustakaan"]),
  B("M4", "Pengelolaan Sekolah", "Penerimaan murid baru", "Proses dan data penerimaan murid baru.", ["spmb"]),
  B("K1", "Kekhususan SMK", "Kemitraan dunia kerja dan PKL", "Mitra DUDI, MoU, dan pelaksanaan PKL.", ["dudi", "pkl"]),
];

const teks = (v: unknown, maks: number) => String(v ?? "").trim().slice(0, maks);
/** Rapikan kiriman penyunting: kunci sumber harus ada di katalog; tautan hanya jalur situs ("/…") atau https. */
export function rapikanButir(masukan: unknown): ButirAkreditasi[] {
  return (Array.isArray(masukan) ? masukan : []).slice(0, 200).map(x => {
    const b = (x ?? {}) as Record<string, unknown>;
    return {
      id: /^[A-Za-z0-9_-]{4,40}$/.test(String(b.id ?? "")) ? String(b.id) : randomBytes(6).toString("hex"),
      kode: teks(b.kode, 20), kelompok: teks(b.kelompok, 80) || "Lainnya", judul: teks(b.judul, 200), uraian: teks(b.uraian, 1000), catatan: teks(b.catatan, 1000),
      sumber: [...new Set((Array.isArray(b.sumber) ? b.sumber : []).map(String).filter(k => KUNCI_SAH.has(k)))],
      tautan: (Array.isArray(b.tautan) ? b.tautan : []).slice(0, 12).map(t => ({ label: teks((t as Record<string, unknown>)?.label, 120), url: teks((t as Record<string, unknown>)?.url, 500) }))
        .filter(t => t.label && (/^\/[^/\\]/.test(t.url) || /^https:\/\//i.test(t.url))),
    };
  }).filter(b => b.judul);
}

export async function bacaButir(): Promise<{ butir: ButirAkreditasi[]; bawaan: boolean }> {
  const s = await prisma.siteSetting.findUnique({ where: { key: KUNCI_BUTIR }, select: { value: true } }).catch(() => null);
  if (!s?.value) return { butir: BAWAAN, bawaan: true };
  try { return { butir: rapikanButir(JSON.parse(s.value)), bawaan: false }; } catch { return { butir: BAWAAN, bawaan: true }; }
}
export async function simpanButir(butir: ButirAkreditasi[]) {
  const value = JSON.stringify(butir);
  await prisma.siteSetting.upsert({ where: { key: KUNCI_BUTIR }, create: { key: KUNCI_BUTIR, value }, update: { value } });
}

/** Butir + katalog sumber beserta jumlahnya SEKARANG. Satu sumber yang gagal dihitung tidak menjatuhkan halaman (jumlah null). */
export async function susunBuktiAkreditasi() {
  const pk = await pekanKini();
  const tahunAwal = Number(pk.tahunAjaran.slice(0, 4));
  const k: Konteks = { awalTA: new Date(`${tahunAwal}-07-01T00:00:00Z`), awalSem: new Date(`${pk.mulai}T00:00:00Z`), semLabel: pk.label, tahunAjaran: pk.tahunAjaran, semester: pk.semester };
  const [{ butir, bawaan }, jumlah] = await Promise.all([
    bacaButir(),
    Promise.all(KATALOG.map(s => s.hitung(k).catch(() => null))),
  ]);
  const katalog = KATALOG.map((s, i) => ({ kunci: s.kunci, label: s.label, satuan: s.satuan, admin: s.admin, guru: s.guru, jumlah: jumlah[i] }));
  return { semester: pk.label, tahunAjaran: pk.tahunAjaran, butir, bawaan, katalog };
}
