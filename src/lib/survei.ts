import "server-only";
import { createHash } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import { hakPengumuman, konteksPenerima, syaratSasaran, type HakPengumuman, type KonteksPenerima } from "@/lib/pengumuman";

/** SURVEI & ANGKET (17 Sep 2026). Sasaran memakai aturan pengumuman. Pembuat: Admin/TU/pimpinan (semua),
 * Guru BK & Wakasek Kesiswaan (semua; AKPD & sosiometri), wali kelas (kelasnya). Hasil survei `hasilRahasia`
 * hanya untuk pembuatnya, Guru BK/Wakasek Kesiswaan, dan Admin. */

type Sesi = { userId: string; email: string; role: string };
export const TIPE_PERTANYAAN = ["PILIHAN", "CENTANG", "SKALA", "TEKS", "TEMAN"] as const;
export const JENIS_SURVEI: Record<string, string> = { UMUM: "Survei umum", AKPD: "AKPD (kebutuhan peserta didik)", SOSIOMETRI: "Sosiometri kelas", EVALUASI: "Evaluasi kegiatan/layanan" };

export async function hakSurvei(s: Sesi): Promise<HakPengumuman & { bk: boolean }> {
  const hak = await hakPengumuman(s);
  if (s.role === "ADMIN") return { ...hak, bk: true };
  const jab = s.role === "TEACHER" || s.role === "TAS" ? await getJabatanNames(s.email) : [];
  const bk = KESISWAAN_BK_JABATAN.some(j => jab.includes(j));
  return bk ? { boleh: true, semua: true, waliKelas: hak.waliKelas, bk } : { ...hak, bk };
}

/** Survei yang boleh dikelola/diihat hasilnya oleh pengguna ini. */
export function whereKelola(s: Sesi, hak: { semua: boolean; bk: boolean }): Prisma.SurveiWhereInput {
  if (s.role === "ADMIN") return {};
  if (hak.bk) return {};
  if (hak.semua) return { OR: [{ hasilRahasia: false }, { pembuatId: s.userId }] };
  return { pembuatId: s.userId };
}

export const penandaRespons = (userId: string, surveiId: string) =>
  createHash("sha256").update(`${process.env.SESSION_SECRET ?? ""}|survei|${surveiId}|${userId}`).digest("hex");

/** Survei terbuka untuk pengguna ini + apakah sudah diisi. */
export async function surveiUntuk(s: Sesi) {
  return surveiUntukKonteks(s.userId, await konteksPenerima(s));
}

export async function surveiUntukKonteks(userId: string, k: KonteksPenerima) {
  const sy = syaratSasaran(k);
  const now = new Date();
  const daftar = await prisma.survei.findMany({
    where: { status: "DIBUKA", targetRole: sy.targetRole, AND: [...sy.AND, { OR: [{ selesai: null }, { selesai: { gte: now } }] }] },
    orderBy: { createdAt: "desc" },
    select: { id: true, judul: true, deskripsi: true, jenis: true, anonim: true, selesai: true, pembuatNama: true, _count: { select: { pertanyaan: true } } },
  });
  if (!daftar.length) return [];
  const sudah = await prisma.surveiRespons.findMany({
    where: { surveiId: { in: daftar.map(d => d.id) }, penanda: { in: daftar.map(d => penandaRespons(userId, d.id)) } },
    select: { surveiId: true },
  });
  const set = new Set(sudah.map(x => x.surveiId));
  return daftar.map(({ _count, ...d }) => ({ ...d, jumlahPertanyaan: _count.pertanyaan, sudahDiisi: set.has(d.id) }));
}

export async function jumlahSurveiBelumDiisi(s: Sesi) {
  return (await surveiUntuk(s).catch(() => [])).filter(x => !x.sudahDiisi).length;
}

/** Templat AKPD ringkas (Alat Ungkap Kebutuhan Peserta Didik) — butir boleh diubah sebelum dibuka. */
export const TEMPLAT_AKPD: { kelompok: string; teks: string }[] = [
  { kelompok: "PRIBADI", teks: "Saya sering merasa cemas atau khawatir tanpa sebab yang jelas" },
  { kelompok: "PRIBADI", teks: "Saya kurang percaya diri saat berbicara di depan orang lain" },
  { kelompok: "PRIBADI", teks: "Saya sulit mengatur waktu antara kegiatan asrama, ibadah, dan belajar" },
  { kelompok: "PRIBADI", teks: "Saya sering merasa rindu rumah sehingga sulit berkonsentrasi" },
  { kelompok: "PRIBADI", teks: "Saya ingin lebih istiqamah menjalankan ibadah dan hafalan" },
  { kelompok: "SOSIAL", teks: "Saya sulit mendapatkan teman dekat di sekolah/asrama" },
  { kelompok: "SOSIAL", teks: "Saya pernah diejek, dikucilkan, atau diperlakukan tidak menyenangkan oleh teman" },
  { kelompok: "SOSIAL", teks: "Saya sering berselisih dengan teman sekamar atau sekelas" },
  { kelompok: "SOSIAL", teks: "Saya kurang dekat atau sulit berkomunikasi dengan orang tua" },
  { kelompok: "SOSIAL", teks: "Saya merasa kurang nyaman berbicara dengan guru" },
  { kelompok: "BELAJAR", teks: "Saya sulit memahami pelajaran tertentu" },
  { kelompok: "BELAJAR", teks: "Saya mudah mengantuk atau lelah saat belajar di kelas" },
  { kelompok: "BELAJAR", teks: "Saya belum mengetahui cara belajar yang cocok untuk saya" },
  { kelompok: "BELAJAR", teks: "Saya sering menunda mengerjakan tugas" },
  { kelompok: "BELAJAR", teks: "Saya kesulitan pada mata pelajaran praktik kejuruan" },
  { kelompok: "KARIR", teks: "Saya belum tahu ingin bekerja, kuliah, atau berwirausaha setelah lulus" },
  { kelompok: "KARIR", teks: "Saya ragu apakah jurusan saya sesuai dengan minat saya" },
  { kelompok: "KARIR", teks: "Saya membutuhkan informasi tentang tempat PKL dan dunia kerja" },
  { kelompok: "KARIR", teks: "Saya membutuhkan informasi beasiswa dan perguruan tinggi" },
  { kelompok: "KARIR", teks: "Saya ingin mengembangkan keterampilan wirausaha" },
];
export const BIDANG_AKPD: Record<string, string> = { PRIBADI: "Pribadi", SOSIAL: "Sosial", BELAJAR: "Belajar", KARIR: "Karier" };

export async function kelasSiswa(userId: string) {
  return prisma.student.findFirst({ where: { userId }, select: { id: true, classId: true } });
}
