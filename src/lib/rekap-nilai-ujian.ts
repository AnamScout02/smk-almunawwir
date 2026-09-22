import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { filterDaftarUjian, kelasPeserta, teacherIdDariSesi } from "@/lib/ujian-server";
import { hitungBelumDikoreksi } from "@/lib/soal";
import { petaKkm } from "@/lib/kkm";
import { bulat, type DataRekap, type SelNilai } from "@/lib/rekap-nilai-hitung";
import { kunciNamaMapel, namaMapelDiniyah } from "@/lib/mapel-diniyah";
import { petaSingkatanMapel } from "@/lib/singkatan-mapel-server";

/** Kegiatan yang punya ujian — pilihan di halaman Rekap Nilai. */
export async function daftarKegiatanRekap() {
  const k = await prisma.kegiatanUjian.findMany({
    where: { exams: { some: {} } },
    orderBy: [{ aktif: "desc" }, { tanggalMulai: "desc" }, { createdAt: "desc" }],
    select: { id: true, nama: true, singkatan: true, aktif: true, academicYear: { select: { name: true } }, _count: { select: { exams: true } } },
  });
  return k.map(x => ({ id: x.id, nama: x.nama, singkatan: x.singkatan, aktif: x.aktif, tahunAjaran: x.academicYear?.name ?? null, jumlahUjian: x._count.exams }));
}

/** Data mentah rekap satu kegiatan, sesuai cakupan pemanggil:
 *   - Admin/TAS/Wakil Kepala Kurikulum: semua ujian.
 *   - Guru: ujian yang ia buat/ampu (sama dengan Daftar Ujian) + SEMUA ujian kelas walinya (leger kelas wali lengkap). */
export async function muatRekapNilai(session: { role: string; email: string }, kegiatanId: string): Promise<DataRekap | null> {
  const kegiatan = await prisma.kegiatanUjian.findUnique({
    where: { id: kegiatanId }, select: { id: true, nama: true, singkatan: true, academicYear: { select: { name: true } } },
  });
  if (!kegiatan) return null;

  const cakupan = await filterDaftarUjian(session);
  let where: Prisma.ExamWhereInput = { kegiatanId };
  if (cakupan) {
    const guru = await teacherIdDariSesi(session);
    const kelasWali = guru ? (await prisma.class.findMany({ where: { homeroomId: guru }, select: { id: true } })).map(k => k.id) : [];
    where = { kegiatanId, OR: [cakupan, ...(kelasWali.length ? [{ kelasIds: { hasSome: kelasWali } }, { classId: { in: kelasWali } }] : [])] };
  }
  const exams = await prisma.exam.findMany({
    where,
    select: {
      id: true, subject: true, jenis: true, classId: true, kelasIds: true,
      attempts: { where: { submittedAt: { not: null } }, select: { studentId: true, score: true, skorButir: true, submittedAt: true } },
    },
  });

  const mapelKelas: Record<string, Set<string>> = {};
  for (const e of exams) {
    if (e.jenis !== "REGULER") continue;
    for (const k of kelasPeserta(e)) (mapelKelas[k] ??= new Set()).add(e.subject.trim());
  }
  const kelasIds = Object.keys(mapelKelas);
  const [kelas, siswa] = await Promise.all([
    prisma.class.findMany({ where: { id: { in: kelasIds } }, select: { id: true, name: true, grade: true, majorId: true, major: { select: { code: true, name: true } } } }),
    prisma.student.findMany({
      where: { classId: { in: kelasIds }, studentStatus: "AKTIF" },
      select: { id: true, nis: true, classId: true, user: { select: { name: true } } },
    }),
  ]);

  // Nilai: reguler = nilai utama; susulan mengisi bila reguler kosong; remedial disimpan terpisah (nilai tertinggi).
  const nilai: Record<string, Record<string, SelNilai>> = {};
  const urutJenis = (j: string) => (j === "REGULER" ? 0 : j === "SUSULAN" ? 1 : 2);
  for (const e of [...exams].sort((a, b) => urutJenis(a.jenis) - urutJenis(b.jenis))) {
    const m = e.subject.trim();
    for (const a of e.attempts) {
      if (a.score == null) continue;
      const sel = ((nilai[a.studentId] ??= {})[m] ??= { n: null });
      const n = bulat(a.score);
      const sementara = hitungBelumDikoreksi(a.skorButir) > 0;
      if (e.jenis === "REMEDIAL") { sel.r = Math.max(sel.r ?? 0, n); continue; }
      if (e.jenis === "SUSULAN") { if (sel.n === null) { sel.n = n; sel.su = true; sel.s = sementara || undefined; } continue; }
      if (sel.n === null || sel.su) { sel.n = n; sel.su = undefined; sel.s = sementara || undefined; }
    }
  }

  // KKM per kelas (tingkat + jurusan), disinggahkan per pasangan tingkat|jurusan.
  const singgah = new Map<string, Awaited<ReturnType<typeof petaKkm>>>();
  const kkm: Record<string, Record<string, number>> = {};
  for (const k of kelas) {
    const kunci = `${k.grade}|${k.majorId}`;
    if (!singgah.has(kunci)) singgah.set(kunci, await petaKkm({ grade: k.grade, majorId: k.majorId }));
    const p = singgah.get(kunci)!;
    kkm[k.id] = Object.fromEntries([...(mapelKelas[k.id] ?? [])].map(m => [m, p.kkmUntuk(m)]));
  }

  const diniyah = await namaMapelDiniyah();
  const semuaNamaMapel = [...new Set(Object.values(mapelKelas).flatMap(s => [...s]))];
  return {
    kegiatan: { id: kegiatan.id, nama: kegiatan.nama, singkatan: kegiatan.singkatan, tahunAjaran: kegiatan.academicYear?.name ?? null },
    diniyah: semuaNamaMapel.filter(m => diniyah.has(kunciNamaMapel(m))),
    singkatan: await petaSingkatanMapel(semuaNamaMapel),
    kelas: kelas.map(k => ({ id: k.id, nama: k.name, grade: k.grade, jurusan: k.major?.code || k.major?.name || "-" }))
      .sort((a, b) => a.grade - b.grade || a.nama.localeCompare(b.nama, "id", { numeric: true })),
    mapelKelas: Object.fromEntries(Object.entries(mapelKelas).map(([k, s]) => [k, [...s].sort((a, b) => a.localeCompare(b, "id"))])),
    siswa: siswa.filter(s => s.classId).map(s => ({ id: s.id, nis: s.nis, nama: s.user.name, classId: s.classId! })),
    nilai,
    kkm,
  };
}
