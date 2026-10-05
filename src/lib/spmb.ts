import "server-only";
import { prisma } from "@/lib/prisma";
import { assertJabatan, getJabatanNames } from "@/lib/jabatan-guard";

/** SPMB — Seleksi Penerimaan Murid Baru (portal /pusat-spmb, 1 Oktober 2026).
 *
 *  Tiga keputusan user yang membentuk modul ini:
 *  1. Pendaftaran BERGELOMBANG — tanggal, biaya, dan kuota per jurusan melekat pada gelombang.
 *  2. Komponen penilaian DITENTUKAN PANITIA, bukan ditanam di kode ("bisa disesuaikan dari semua
 *     pilihan"): sekolah boleh memakai nilai rapor saja, atau menambah tes tulis, baca Qur'an,
 *     wawancara, dan kesehatan dengan bobot masing-masing.
 *  3. Calon mendaftar TANPA AKUN — dikenali lewat nomor pendaftaran + tanggal lahir.
 */

export const JABATAN_SPMB = [
  "Wakil Kepala Kesiswaan",
  "Wakil Kepala Humas",
  "Kepala Sekolah",
  "Operator Sekolah",
  "Koordinator Tim Branding & Publikasi",
];

/** Admin & staf TU otomatis lolos (tidak masuk cabang `if`) — pola standar CLAUDE.md #13. */
export async function assertSpmb(session: { role: string; email: string }) {
  if (session.role === "TEACHER") await assertJabatan(session, JABATAN_SPMB);
}

export async function bolehSpmb(session: { role: string; email: string }): Promise<boolean> {
  if (session.role === "ADMIN" || session.role === "TAS") return true;
  if (session.role !== "TEACHER") return false;
  const j: string[] = await getJabatanNames(session.email).catch(() => []);
  return JABATAN_SPMB.some(x => j.includes(x));
}

export { STATUS_SPMB, LABEL_STATUS } from "./spmb-status";

/** Gelombang yang SEDANG dibuka menurut jam sekarang. Null = pendaftaran sedang tutup. */
export async function gelombangDibuka(sekarang = new Date()) {
  return prisma.gelombangSpmb.findFirst({
    where: { aktif: true, buka: { lte: sekarang }, tutup: { gte: sekarang } },
    orderBy: { urutan: "asc" },
    include: { kuota: true },
  });
}

/** Nomor pendaftaran berurut per gelombang: SPMB-<urutan gelombang>-<4 digit>.
 *  Dihitung dari jumlah baris yang sudah ada di gelombang itu, lalu dinaikkan sampai benar-benar
 *  belum dipakai — kolomnya unik, jadi tabrakan karena dua pendaftar bersamaan tetap aman. */
export async function nomorPendaftaranBaru(gelombangId: string, urutanGelombang: number): Promise<string> {
  const awalan = `SPMB-${String(urutanGelombang).padStart(2, "0")}`;
  const jumlah = await prisma.admission.count({ where: { gelombangId } });
  for (let i = jumlah + 1; i < jumlah + 500; i++) {
    const nomor = `${awalan}-${String(i).padStart(4, "0")}`;
    const ada = await prisma.admission.findUnique({ where: { nomor }, select: { id: true } });
    if (!ada) return nomor;
  }
  throw new Error("Nomor pendaftaran habis");
}

export interface KomponenRingkas { id: string; jenis: string; bobot: number; nilaiMaks: number }
export interface NilaiRingkas { komponenId: string; nilai: number | null; lulus: boolean | null }

/**
 * Skor akhir 0–100 dari komponen ANGKA, berbobot. Komponen LULUS_TIDAK tidak menambah skor tetapi
 * MENGGUGURKAN bila ditandai tidak lulus — itu gunanya tes kesehatan / baca Qur'an sebagai syarat.
 *
 * Bobot dinormalkan terhadap komponen yang BENAR-BENAR dinilai, supaya pendaftar yang satu
 * komponennya belum diisi tidak langsung jatuh ke bawah dan terlihat seperti nilainya jelek.
 */
export function hitungSkorSpmb(komponen: KomponenRingkas[], nilai: NilaiRingkas[]) {
  const peta = new Map(nilai.map(n => [n.komponenId, n]));
  let gugur = false;
  let totalBobot = 0, totalNilai = 0, terisi = 0, jumlahAngka = 0;
  for (const k of komponen) {
    const n = peta.get(k.id);
    if (k.jenis === "LULUS_TIDAK") {
      if (n?.lulus === false) gugur = true;
      continue;
    }
    // PRESTASI ikut berhitung seperti ANGKA — `nilai`-nya sudah diisi server dari tabel bobot
    // sertifikat, dan `nilaiMaks`-nya = bobot tertinggi di tabel itu.
    jumlahAngka++;
    if (!n || n.nilai === null || n.nilai === undefined) continue;
    const maks = k.nilaiMaks > 0 ? k.nilaiMaks : 100;
    totalBobot += k.bobot;
    totalNilai += (Math.min(n.nilai, maks) / maks) * 100 * k.bobot;
    terisi++;
  }
  const skor = totalBobot > 0 ? Math.round((totalNilai / totalBobot) * 100) / 100 : null;
  return { skor, gugur, terisi, jumlahAngka, lengkap: jumlahAngka > 0 && terisi === jumlahAngka };
}

/** Folder RAHASIA berkas pendaftar — KK, akta, dan KTP wali adalah data pribadi keluarga. */
export const FOLDER_BERKAS_SPMB = "spmb";

/** Penjaga untuk route SPMB yang SEBELUMNYA hanya dipakai Tata Usaha (`verifyTasAccess`).
 *  Sejak portal Pusat SPMB dibuka untuk panitia berjabatan (1 Oktober 2026), route itu harus
 *  menerima mereka juga — kalau tidak, tautan di portal memantul kembali ke dashboard dan
 *  pengguna membacanya sebagai "tombolnya tidak berfungsi" (pelajaran CLAUDE.md #90). */
export async function verifySpmbAccess() {
  const { verifyRole } = await import("@/lib/dal");
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await assertSpmb(session);
  return session;
}
