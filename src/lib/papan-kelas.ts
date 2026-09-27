import "server-only";
import { prisma } from "@/lib/prisma";

/** PANEL TAMBAHAN PAPAN KELAS (25 September 2026) — kutipan harian, peringkat kedisiplinan antar kelas, dan
 * siswa yang perlu diperhatikan.
 *
 * **Batas yang disepakati dengan user.** Papan kelas sebelumnya sengaja TIDAK PERNAH memuat nama siswa. Panel
 * "perlu diperhatikan" mengubah itu atas permintaan user, jadi jangkauannya dipersempit sejauh mungkin:
 * - Hanya **kelas TV itu sendiri** (`kelasId` layar). Papan tanpa kelas tidak pernah menampilkan nama siapa pun.
 * - Hanya **bulan berjalan**, bukan akumulasi setahun yang membuat satu kesalahan lama menempel berbulan-bulan.
 * - Hanya siswa yang benar-benar melewati ambang, dan maksimal lima nama.
 * - **Sakit & izin tidak diperingatkan** — itu bukan pelanggaran. Keduanya ditampilkan sebagai angka rekap kelas
 *   saja, supaya wali kelas tahu polanya tanpa menempelkan kondisi kesehatan seorang anak di dinding.
 *
 * Peringkat kedisiplinan dihitung ANTAR KELAS (agregat, tanpa nama) dari `StudentPointRecord` bulan berjalan:
 * prestasi menambah, pelanggaran mengurangi. Dibandingkan per siswa supaya kelas berisi banyak siswa tidak
 * otomatis kalah. */

export interface KutipanPapan { arab: string; terjemahan: string; sumber: string }
export interface PeringkatKelas { kelas: string; skor: number; prestasi: number; pelanggaran: number }
export interface SiswaPerluPerhatian { nama: string; alpha: number }
export interface RekapKehadiranKelas { hadir: number; izin: number; sakit: number; alpha: number }

/** Satu kutipan per hari, bergilir berurutan menurut tanggal — bukan acak, supaya seluruh sekolah melihat
 * kutipan yang sama pada hari yang sama dan bisa dibicarakan bersama. */
export function kutipanHariIni(setelan: Record<string, string>, wib: Date): KutipanPapan | null {
  const daftar: KutipanPapan[] = [];
  for (let n = 1; n <= 5; n++) {
    const arab = (setelan[`papan.kutipan${n}_arabic`] ?? "").trim();
    const terjemahan = (setelan[`papan.kutipan${n}_trans`] ?? "").trim();
    if (!arab && !terjemahan) continue;                       // isian kosong dilewati, bukan jadi kartu kosong
    daftar.push({ arab, terjemahan, sumber: (setelan[`papan.kutipan${n}_source`] ?? "").trim() });
  }
  if (!daftar.length) return null;
  const hariKe = Math.floor(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) / 86400_000);
  return daftar[hariKe % daftar.length];
}

/** Peringkat kedisiplinan ANTAR KELAS bulan berjalan. Agregat — tidak ada nama siswa sama sekali. */
export async function peringkatKedisiplinan(wib: Date): Promise<PeringkatKelas[]> {
  const awalBulan = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1));

  const catatan = await prisma.studentPointRecord.findMany({
    where: { date: { gte: awalBulan } },
    select: { kind: true, points: true, student: { select: { class: { select: { name: true } } } } },
  }).catch(() => []);
  if (!catatan.length) return [];

  const jumlahSiswa = await prisma.student.groupBy({
    by: ["classId"], where: { studentStatus: "AKTIF", classId: { not: null } }, _count: { _all: true },
  }).catch(() => [] as { classId: string | null; _count: { _all: number } }[]);
  const kelasSiswa = await prisma.class.findMany({ select: { id: true, name: true } }).catch(() => []);
  const namaKe = new Map(kelasSiswa.map(k => [k.id, k.name]));
  const isiKelas = new Map<string, number>();
  for (const g of jumlahSiswa) {
    const nama = g.classId ? namaKe.get(g.classId) : null;
    if (nama) isiKelas.set(nama, (isiKelas.get(nama) ?? 0) + g._count._all);
  }

  const per = new Map<string, { prestasi: number; pelanggaran: number }>();
  for (const c of catatan) {
    const nama = c.student.class?.name;
    if (!nama) continue;
    const p = per.get(nama) ?? { prestasi: 0, pelanggaran: 0 };
    if (c.kind === "PRESTASI") p.prestasi += Math.abs(c.points);
    else p.pelanggaran += Math.abs(c.points);
    per.set(nama, p);
  }

  return [...per].map(([kelas, p]) => {
    // Dibagi jumlah siswa: kelas berisi 36 anak jangan otomatis kalah dari kelas berisi 20 hanya karena lebih ramai.
    const isi = isiKelas.get(kelas) || 1;
    return { kelas, prestasi: p.prestasi, pelanggaran: p.pelanggaran, skor: Math.round(((p.prestasi - p.pelanggaran) / isi) * 10) / 10 };
  }).sort((a, b) => b.skor - a.skor).slice(0, 8);
}

/** Siswa KELAS INI yang alfanya menonjol bulan ini, plus rekap kehadiran kelas. Tanpa kelas → tanpa nama. */
export async function perluPerhatian(classId: string | null, wib: Date): Promise<{
  siswa: SiswaPerluPerhatian[]; rekap: RekapKehadiranKelas;
}> {
  const kosong = { siswa: [], rekap: { hadir: 0, izin: 0, sakit: 0, alpha: 0 } };
  if (!classId) return kosong;

  const awalBulan = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1));
  const baris = await prisma.attendance.findMany({
    where: { date: { gte: awalBulan }, student: { classId, studentStatus: "AKTIF" } },
    select: { status: true, student: { select: { id: true, user: { select: { name: true } } } } },
  }).catch(() => []);
  if (!baris.length) return kosong;

  const rekap: RekapKehadiranKelas = { hadir: 0, izin: 0, sakit: 0, alpha: 0 };
  const alphaPer = new Map<string, { nama: string; n: number }>();
  for (const b of baris) {
    if (b.status === "HADIR") rekap.hadir++;
    else if (b.status === "IZIN") rekap.izin++;
    else if (b.status === "SAKIT") rekap.sakit++;
    else if (b.status === "ALPHA") {
      rekap.alpha++;
      const a = alphaPer.get(b.student.id) ?? { nama: b.student.user.name, n: 0 };
      a.n++; alphaPer.set(b.student.id, a);
    }
  }

  // Ambang 3: satu-dua alfa dalam sebulan bisa urusan administrasi yang belum masuk, bukan pola yang perlu ditegur.
  const siswa = [...alphaPer.values()].filter(a => a.n >= 3)
    .sort((a, b) => b.n - a.n).slice(0, 5)
    .map(a => ({ nama: a.nama, alpha: a.n }));

  return { siswa, rekap };
}
