import "server-only";
import { prisma } from "@/lib/prisma";
import { petaKkm } from "@/lib/kkm";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { adalahKategoriDiniyah } from "@/lib/mapel-diniyah";
import { bulat } from "@/lib/rekap-nilai-hitung";
import { BOBOT_BAWAAN, MAKS_LM, MAKS_TP, formKosong, rapikanNilai, type BobotRapor, type EntriRiwayatWali, type ItemTeks, type NilaiSiswaForm, type PengaturanForm } from "@/lib/rapor-form";

/** FORM NILAI RAPOR — sisi server (22 September 2026). Alur sekolah: wali kelas menyebar lembar penilaian → GURU MAPEL mengisi
 * (TP, LM, STS, SAS, nilai yang disesuaikan) → mengirim → wali kelas menyusun rapor. Di situs, lembarnya satu baris
 * `FormNilaiRapor` per kelas × mapel × semester; rapor wali kelas membacanya langsung. Rumus di src/lib/rapor-form.ts.
 *
 * Akses: guru pengampu mapel itu di kelas itu (Penugasan Mengajar) mengisi selama DRAF; wali kelas melihat, bisa
 * mengembalikan, dan bisa MENGEDIT setelah form DIKIRIM (tercatat di riwayatWali, terlihat guru); Admin/TAS mengubah kapan
 * pun; Wakil Kepala Kurikulum & Kepala Sekolah melihat semua. */

export const JABATAN_PEMANTAU_RAPOR = ["Wakil Kepala Kurikulum", "Kepala Sekolah"];

export type Peran = "GURU" | "WALI" | "PENGELOLA" | "PEMANTAU";
export interface AksesForm { peran: Peran; bolehUbah: boolean; bolehKembalikan: boolean; teacherId: string | null }

export async function teacherDariSesi(email: string) {
  return prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true, user: { select: { name: true } } } });
}

/** Kelompok rapor dari kategori mapel: Diniyah → rapor Diniyah; Kejuruan/Pilihan/Kompetensi → Kelompok Kejuruan; lainnya Umum. */
export function kelompokMapel(kategori: string | null | undefined): "UMUM" | "KEJURUAN" | "DINIYAH" {
  const k = kategori ?? "";
  if (adalahKategoriDiniyah(k)) return "DINIYAH";
  return /kejuruan|pilihan|kompetensi|c3/i.test(k) ? "KEJURUAN" : "UMUM";
}

export async function aksesForm(session: { role: string; email: string }, classId: string, subject: string): Promise<AksesForm | null> {
  if (session.role === "ADMIN" || session.role === "TAS") return { peran: "PENGELOLA", bolehUbah: true, bolehKembalikan: true, teacherId: null };
  if (session.role !== "TEACHER") return null;
  const t = await teacherDariSesi(session.email);
  if (!t) return null;
  const [tugas, kelas] = await Promise.all([
    prisma.teachingAssignment.findFirst({ where: { classId, teacherId: t.id, subject: { name: subject } }, select: { id: true } }),
    prisma.class.findUnique({ where: { id: classId }, select: { homeroomId: true } }),
  ]);
  if (tugas) return { peran: "GURU", bolehUbah: true, bolehKembalikan: kelas?.homeroomId === t.id, teacherId: t.id };
  // Wali kelas boleh mengedit HANYA form yang sudah DIKIRIM (dicek di route simpan); perubahannya tercatat di riwayatWali.
  if (kelas?.homeroomId === t.id) return { peran: "WALI", bolehUbah: true, bolehKembalikan: true, teacherId: t.id };
  const jabatan = await getJabatanNames(session.email);
  if (JABATAN_PEMANTAU_RAPOR.some(j => jabatan.includes(j))) return { peran: "PEMANTAU", bolehUbah: false, bolehKembalikan: false, teacherId: t.id };
  return null;
}

/** Akses cetak rapor satu kelas: wali kelasnya (boleh mengisi sikap & keputusan), Admin/TAS (pengelola), Wakil Kepala
 * Kurikulum & Kepala Sekolah (melihat & mencetak). */
export async function aksesRaporKelas(session: { role: string; email: string }, classId: string): Promise<"WALI" | "PENGELOLA" | "PEMANTAU" | null> {
  if (session.role === "ADMIN" || session.role === "TAS") return "PENGELOLA";
  if (session.role !== "TEACHER") return null;
  const t = await teacherDariSesi(session.email);
  if (!t) return null;
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { homeroomId: true } });
  if (!kelas) return null;
  if (kelas.homeroomId === t.id) return "WALI";
  const jabatan = await getJabatanNames(session.email);
  return JABATAN_PEMANTAU_RAPOR.some(j => jabatan.includes(j)) ? "PEMANTAU" : null;
}

/** "Ganjil 2026/2027" → { jenis: "GANJIL", tahun: "2026/2027" }. */
export function uraiSemester(semester: string): { jenis: "GANJIL" | "GENAP"; tahun: string } | null {
  const m = /^(Ganjil|Genap)\s+(\d{4}\/\d{4})$/.exec(semester.trim());
  return m ? { jenis: m[1] === "Ganjil" ? "GANJIL" : "GENAP", tahun: m[2] } : null;
}

const arrTeks = (x: unknown, awalan: string, maks: number): ItemTeks[] => {
  const a = Array.isArray(x) ? (x as { kode?: unknown; teks?: unknown }[]) : [];
  return Array.from({ length: maks }, (_, i) => ({ kode: `${awalan}-${i + 1}`, teks: String(a[i]?.teks ?? "").slice(0, 300) }));
};
const bobotDari = (x: unknown): BobotRapor => {
  const b = (x ?? {}) as Partial<BobotRapor>;
  const n = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Math.max(0, Math.min(100, Number(v))) : d);
  return { rph: n(b.rph, BOBOT_BAWAAN.rph), sts: n(b.sts, BOBOT_BAWAAN.sts), sasTes: n(b.sasTes, BOBOT_BAWAAN.sasTes), sasNonTes: n(b.sasNonTes, BOBOT_BAWAAN.sasNonTes) };
};

/** Bersihkan nilai per siswa dari layar: hanya siswa kelas itu, angka 0–100, TP 0/1. */
export function rapikanNilaiSiswa(x: unknown, siswaIds: Set<string>, f: PengaturanForm): Record<string, NilaiSiswaForm> {
  const hasil: Record<string, NilaiSiswaForm> = {};
  const obj = (x && typeof x === "object" ? x : {}) as Record<string, NilaiSiswaForm>;
  for (const [sid, v] of Object.entries(obj)) {
    if (!siswaIds.has(sid) || !v || typeof v !== "object") continue;
    const tp: NilaiSiswaForm["tp"] = {};
    for (const t of f.tp) {
      const e = v.tp?.[t.kode];
      if (e) tp[t.kode] = { kktp: rapikanNilai(e.kktp, 1), tampil: rapikanNilai(e.tampil, 1) };
    }
    const lm: NilaiSiswaForm["lm"] = {};
    for (const l of f.lm) {
      const e = v.lm?.[l.kode];
      if (e) lm[l.kode] = { tes: rapikanNilai(e.tes), nonTes: rapikanNilai(e.nonTes) };
    }
    hasil[sid] = {
      tp, lm, sts: rapikanNilai(v.sts), sasTes: rapikanNilai(v.sasTes), sasNonTes: rapikanNilai(v.sasNonTes),
      pengetahuan: rapikanNilai(v.pengetahuan), penerapan: rapikanNilai(v.penerapan),
    };
  }
  return hasil;
}

export async function siswaKelas(classId: string) {
  return prisma.student.findMany({
    where: { classId, studentStatus: "AKTIF" },
    select: { id: true, nis: true, nisn: true, gender: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
}

/** Muat satu form (atau kerangka kosong bila belum pernah dibuat) + siswa + identitas. */
export async function muatForm(classId: string, subject: string, semester: string) {
  const kelas = await prisma.class.findUnique({
    where: { id: classId },
    select: { id: true, name: true, grade: true, majorId: true, homeroom: { select: { user: { select: { name: true } } } } },
  });
  if (!kelas) return null;
  const [mapel, siswa, kkmPeta, form, tugas] = await Promise.all([
    prisma.subject.findFirst({ where: { name: subject, grade: kelas.grade, OR: [{ majorId: null }, { majorId: kelas.majorId }] }, select: { category: true, namaArab: true } }),
    siswaKelas(classId),
    petaKkm({ grade: kelas.grade, majorId: kelas.majorId }),
    prisma.formNilaiRapor.findUnique({ where: { classId_subject_semester: { classId, subject, semester } } }),
    prisma.teachingAssignment.findFirst({ where: { classId, subject: { name: subject } }, select: { teacher: { select: { id: true, user: { select: { name: true } } } } } }),
  ]);
  const jenis = kelompokMapel(mapel?.category) === "DINIYAH" ? "DINIYAH" : "UMUM";
  const kkm = form?.kkm ?? kkmPeta.kkmUntuk(subject);
  const dasar = formKosong(jenis, kkm);
  const pengaturan: PengaturanForm = form
    ? { jenis, kkm, katrol: form.katrol, bobot: bobotDari(form.bobot), tp: arrTeks(form.tp, "TP", MAKS_TP), lm: arrTeks(form.lm, "LM", MAKS_LM) }
    : dasar;
  return {
    kelas: { id: kelas.id, nama: kelas.name, grade: kelas.grade, wali: kelas.homeroom?.user.name ?? null },
    mapel: { nama: subject, kategori: mapel?.category ?? null, namaArab: mapel?.namaArab ?? null },
    guru: tugas?.teacher.user.name ?? null,
    semester, pengaturan,
    nilai: (form?.nilai ?? {}) as Record<string, NilaiSiswaForm>,
    status: form?.status ?? "BELUM",
    dikirimAt: form?.dikirimAt ?? null, dikirimOleh: form?.dikirimOleh ?? null, catatanWali: form?.catatanWali ?? null,
    diubahAt: form?.updatedAt ?? null, diubahOleh: form?.diubahOleh ?? null,
    riwayatWali: (Array.isArray(form?.riwayatWali) ? form.riwayatWali : []) as unknown as EntriRiwayatWali[],
    siswa: siswa.map(s => ({ id: s.id, nis: s.nis, nisn: s.nisn, jk: s.gender, nama: s.user.name })),
  };
}

/** USULAN ISIAN dari data yang SUDAH ADA (bukan aturan baru — keputusan user 22 Sep 2026):
 *  - LM & TP = materi Jurnal Mengajar semester itu, urut tanggal pertama diajarkan (maks 10);
 *  - nilai LM: TES = rata Pengetahuan materi itu, NON TES = rata Keterampilan;
 *  - TP: KKTP 1 bila rata materi ≥ KKM, Tampil 1;
 *  - STS & SAS tes = nilai CBT kegiatan STS/SAS semester itu (reguler; susulan mengisi bila reguler kosong);
 *  - Diniyah: Pengetahuan & Penerapan = rata Pengetahuan & Keterampilan jurnal. */
export async function usulanIsian(classId: string, subject: string, semester: string, kkm: number) {
  const siswa = await siswaKelas(classId);
  const ids = siswa.map(s => s.id);
  const entri = await prisma.journalEntry.findMany({
    where: { studentId: { in: ids }, journal: { classId, subject, semester } },
    select: { studentId: true, scorePengetahuan: true, scoreKeterampilan: true, journal: { select: { materi: true, date: true } } },
  });
  const pertama = new Map<string, number>();
  for (const e of entri) {
    const m = e.journal.materi?.trim();
    if (!m) continue;
    const t = e.journal.date.getTime();
    if (!pertama.has(m) || t < pertama.get(m)!) pertama.set(m, t);
  }
  const materi = [...pertama.entries()].sort((a, b) => a[1] - b[1]).slice(0, MAKS_LM).map(([m]) => m);
  const tp = Array.from({ length: MAKS_TP }, (_, i) => ({ kode: `TP-${i + 1}`, teks: materi[i] ?? "" }));
  const lm = Array.from({ length: MAKS_LM }, (_, i) => ({ kode: `LM-${i + 1}`, teks: materi[i] ?? "" }));

  const rata = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);
  type Kumpulan = { p: number[]; k: number[]; per: Map<string, { p: number[]; k: number[] }> };
  const kumpul = new Map<string, Kumpulan>();
  for (const e of entri) {
    const b: Kumpulan = kumpul.get(e.studentId) ?? { p: [], k: [], per: new Map() };
    if (e.scorePengetahuan !== null) b.p.push(e.scorePengetahuan);
    if (e.scoreKeterampilan !== null) b.k.push(e.scoreKeterampilan);
    const m = e.journal.materi?.trim();
    if (m) {
      const x = b.per.get(m) ?? { p: [], k: [] };
      if (e.scorePengetahuan !== null) x.p.push(e.scorePengetahuan);
      if (e.scoreKeterampilan !== null) x.k.push(e.scoreKeterampilan);
      b.per.set(m, x);
    }
    kumpul.set(e.studentId, b);
  }

  // CBT: kegiatan STS & SAS semester itu.
  const sem = uraiSemester(semester);
  const cbt = new Map<string, { sts?: number; sas?: number }>();
  if (sem) {
    const exams = await prisma.exam.findMany({
      where: {
        subject, kelasIds: { has: classId },
        kegiatan: { jenis: { in: ["STS", "SAS"] }, semester: sem.jenis, academicYear: { name: sem.tahun } },
      },
      select: { jenis: true, kegiatan: { select: { jenis: true } }, attempts: { where: { studentId: { in: ids }, submittedAt: { not: null } }, select: { studentId: true, score: true } } },
    });
    const urut = (j: string) => (j === "REGULER" ? 0 : j === "SUSULAN" ? 1 : 2);
    for (const e of [...exams].sort((a, b) => urut(a.jenis) - urut(b.jenis))) {
      if (e.jenis === "REMEDIAL") continue;
      const kunci = e.kegiatan?.jenis === "STS" ? "sts" : "sas";
      for (const a of e.attempts) {
        if (a.score == null) continue;
        const x = cbt.get(a.studentId) ?? {};
        if (x[kunci] === undefined) x[kunci] = bulat(a.score);
        cbt.set(a.studentId, x);
      }
    }
  }

  const nilai: Record<string, NilaiSiswaForm> = {};
  for (const s of siswa) {
    const b = kumpul.get(s.id);
    const n: NilaiSiswaForm = { tp: {}, lm: {} };
    materi.forEach((m, i) => {
      const x = b?.per.get(m);
      const tes = rata(x?.p ?? []), non = rata(x?.k ?? []);
      if (tes !== null || non !== null) n.lm![`LM-${i + 1}`] = { tes, nonTes: non };
      const r = rata([...(x?.p ?? []), ...(x?.k ?? [])]);
      if (r !== null) n.tp![`TP-${i + 1}`] = { kktp: r >= kkm ? 1 : 0, tampil: 1 };
    });
    const c = cbt.get(s.id);
    if (c?.sts !== undefined) n.sts = c.sts;
    if (c?.sas !== undefined) n.sasTes = c.sas;
    n.pengetahuan = rata(b?.p ?? []);
    n.penerapan = rata(b?.k ?? []);
    nilai[s.id] = n;
  }
  return { tp, lm, nilai, sumber: { materi: materi.length, jurnal: entri.length, cbt: cbt.size } };
}
