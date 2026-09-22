import "server-only";
import { prisma } from "@/lib/prisma";
import { kelasPeserta, filterSiswaPeserta } from "@/lib/ujian-server";

/** PESAN PENGAWAS KE LAYAR PESERTA (21 September 2026). Permintaan user: pengawas mengetik "Sisa 10 menit" atau
 * "Ralat soal no. 5" dan pesannya muncul di layar peserta — untuk seluruh peserta, per kelas, per jurusan, atau per
 * siswa. Ditambah per RUANG bila kegiatan memakai Denah Ruang.
 *
 * Pesan dikirim lewat DENYUT yang sudah berjalan tiap 20 detik (bukan saluran baru), jadi jeda terlama ±20 detik.
 * Jurusan & ruang diurai saat dikirim (lihat model PesanUjian) supaya penyaringan di denyut tetap murah. */

export const SASARAN_PESAN = ["SEMUA", "KELAS", "JURUSAN", "SISWA", "RUANG"] as const;
export type SasaranPesan = (typeof SASARAN_PESAN)[number];
export const PANJANG_MAKS_PESAN = 500;

type UjianPesan = { id: string; classId: string; kelasIds: string[]; pesertaIds: string[]; kegiatanId: string | null };

/** Pilihan sasaran untuk formulir pengawas: kelas & jurusan peserta, daftar siswa, dan ruang (bila ada denah). */
export async function opsiSasaranPesan(exam: UjianPesan) {
  const kelasIds = kelasPeserta(exam);
  const [kelas, siswa] = await Promise.all([
    prisma.class.findMany({
      where: { id: { in: kelasIds } }, orderBy: { name: "asc" },
      select: { id: true, name: true, major: { select: { id: true, code: true, name: true } } },
    }),
    prisma.student.findMany({
      where: filterSiswaPeserta(exam), orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }],
      select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } },
    }),
  ]);
  const jurusan = [...new Map(kelas.filter(k => k.major).map(k => [k.major!.id, { id: k.major!.id, label: k.major!.code || k.major!.name }])).values()];
  let ruang: { id: string; nama: string; jumlah: number }[] = [];
  if (exam.kegiatanId) {
    const tempat = await prisma.penempatanRuangUjian.findMany({
      where: { kegiatanId: exam.kegiatanId, studentId: { in: siswa.map(s => s.id) } },
      select: { ruangId: true, ruang: { select: { nama: true } } },
    });
    const peta = new Map<string, { id: string; nama: string; jumlah: number }>();
    for (const t of tempat) {
      const r = peta.get(t.ruangId) ?? { id: t.ruangId, nama: t.ruang.nama, jumlah: 0 };
      r.jumlah++;
      peta.set(t.ruangId, r);
    }
    ruang = [...peta.values()].sort((a, b) => a.nama.localeCompare(b.nama, "id", { numeric: true }));
  }
  return {
    kelas: kelas.map(k => ({ id: k.id, nama: k.name, jumlah: siswa.filter(s => s.classId === k.id).length })),
    jurusan: jurusan.map(j => ({ ...j, jumlah: siswa.filter(s => kelas.find(k => k.id === s.classId)?.major?.id === j.id).length })),
    siswa: siswa.map(s => ({ id: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "" })),
    ruang,
  };
}

/** Validasi & uraikan isian pengawas menjadi baris PesanUjian. */
export async function rapikanPesan(exam: UjianPesan, b: Record<string, unknown>): Promise<
  { data: { teks: string; sasaran: SasaranPesan; kelasIds: string[]; jurusanIds: string[]; ruangIds: string[]; siswaIds: string[]; questionId: string | null } } | { error: string }
> {
  const teks = String(b.teks ?? "").trim().slice(0, PANJANG_MAKS_PESAN);
  if (!teks) return { error: "Tulis isi pesannya dulu." };
  const sasaran = (SASARAN_PESAN as readonly string[]).includes(String(b.sasaran)) ? (b.sasaran as SasaranPesan) : "SEMUA";
  const daftar = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map(String).filter(Boolean))].slice(0, 500) : []);
  const opsi = await opsiSasaranPesan(exam);
  let kelasIds: string[] = [], jurusanIds: string[] = [], ruangIds: string[] = [], siswaIds: string[] = [];

  if (sasaran === "KELAS") {
    kelasIds = daftar(b.kelasIds).filter(id => opsi.kelas.some(k => k.id === id));
    if (!kelasIds.length) return { error: "Pilih minimal satu kelas." };
  } else if (sasaran === "JURUSAN") {
    jurusanIds = daftar(b.jurusanIds).filter(id => opsi.jurusan.some(j => j.id === id));
    if (!jurusanIds.length) return { error: "Pilih minimal satu jurusan." };
    const kelasJurusan = await prisma.class.findMany({ where: { id: { in: kelasPeserta(exam) }, majorId: { in: jurusanIds } }, select: { id: true } });
    kelasIds = kelasJurusan.map(k => k.id);
  } else if (sasaran === "SISWA") {
    siswaIds = daftar(b.siswaIds).filter(id => opsi.siswa.some(s => s.id === id));
    if (!siswaIds.length) return { error: "Pilih minimal satu siswa." };
  } else if (sasaran === "RUANG") {
    ruangIds = daftar(b.ruangIds).filter(id => opsi.ruang.some(r => r.id === id));
    if (!ruangIds.length || !exam.kegiatanId) return { error: "Pilih minimal satu ruang." };
    const tempat = await prisma.penempatanRuangUjian.findMany({
      where: { kegiatanId: exam.kegiatanId, ruangId: { in: ruangIds }, studentId: { in: opsi.siswa.map(s => s.id) } },
      select: { studentId: true },
    });
    siswaIds = [...new Set(tempat.map(t => t.studentId))];
    if (!siswaIds.length) return { error: "Belum ada peserta ujian ini di ruang yang dipilih." };
  }

  let questionId: string | null = null;
  if (b.questionId) {
    const q = await prisma.examQuestion.findFirst({ where: { id: String(b.questionId), examId: exam.id }, select: { id: true } });
    questionId = q?.id ?? null;
  }
  return { data: { teks, sasaran, kelasIds, jurusanIds, ruangIds, siswaIds, questionId } };
}

/** Pesan yang ditujukan ke SATU siswa — dipakai denyut & muatan awal halaman ujian. */
export async function pesanUntukSiswa(examId: string, siswa: { id: string; classId: string | null }) {
  const daftar = await prisma.pesanUjian.findMany({
    where: {
      examId, ditarikAt: null,
      OR: [
        { sasaran: "SEMUA" },
        ...(siswa.classId ? [{ kelasIds: { has: siswa.classId } }] : []),
        { siswaIds: { has: siswa.id } },
      ],
    },
    orderBy: { createdAt: "desc" }, take: 20,
    select: { id: true, teks: true, questionId: true, createdAt: true },
  }).catch(() => []);
  return daftar.map(p => ({ id: p.id, teks: p.teks, questionId: p.questionId, waktu: p.createdAt.toISOString() }));
}
