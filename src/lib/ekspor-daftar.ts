import "server-only";
import { prisma } from "./prisma";
import { getJabatanNames } from "./jabatan-guard";
import { aksesSarpras } from "./sarpras-akses";
import { hitungGizi } from "./uks-akses";
import type { SelBaris } from "./ekspor-excel";

/**
 * REGISTRI UNDUHAN EXCEL untuk daftar/register yang belum punya tombolnya sendiri
 * (permintaan user 29 September 2026: "ada yang perlu download data excel").
 *
 * Satu berkas berisi definisi tiap daftar, satu route (`/api/admin/ekspor/[kunci]`) melayani
 * semuanya — jauh lebih sedikit kode daripada satu route per daftar, DAN penjaganya tetap
 * per-daftar: tiap entri menuliskan `boleh` sendiri memakai aturan akses yang SUDAH berlaku di
 * halamannya. Jangan membuat entri dengan `boleh: () => true` — daftar tanpa penjaga di sini
 * berarti seluruh isi tabel bisa diunduh siapa pun yang bisa masuk dashboard.
 *
 * Angka tetap bertipe number (CLAUDE.md "Export data → Excel"); tanggal diformat WIB.
 */
export interface Sesi { role: string; email: string; userId: string; name: string }

export interface DefEkspor {
  /** Nama sheet & bagian nama berkas. */
  judul: string;
  boleh: (s: Sesi) => Promise<boolean>;
  susun: () => Promise<{ headers: string[]; rows: SelBaris[] }>;
}

const tgl = (d: Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "";

/** Pengelola sarana prasarana (termasuk Kepala Lab untuk lingkup lab) — sama dengan halamannya. */
const bolehSarpras = async (s: Sesi) => (await aksesSarpras(s)).kelola;

/** Kepala UKS / Admin — sama dengan `assertUks`. */
const bolehUks = async (s: Sesi) => {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  return (await getJabatanNames(s.email)).some(j => /kepala uks|tim uks/i.test(j));
};

export const EKSPOR: Record<string, DefEkspor> = {
  inventaris: {
    judul: "Inventaris Barang",
    boleh: bolehSarpras,
    susun: async () => {
      const a = await prisma.asset.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
      return {
        headers: ["No", "Kode Inventaris", "Nama Barang", "Kategori", "Jumlah", "Kondisi", "Lokasi", "Tanggal Perolehan", "Sumber Dana", "Catatan"],
        rows: a.map((x, i) => [i + 1, x.kodeInventaris ?? "", x.name, x.category, x.quantity, x.condition,
          x.location ?? "", tgl(x.acquiredDate), x.fundingSource ?? "", x.notes ?? ""]),
      };
    },
  },
  "sarpras-peminjaman": {
    judul: "Peminjaman Sarpras",
    boleh: bolehSarpras,
    susun: async () => {
      const p = await prisma.peminjamanSarpras.findMany({
        include: { asset: { select: { name: true } } }, orderBy: { mulai: "desc" }, take: 5000,
      });
      return {
        headers: ["No", "Jenis", "Barang / Ruang", "Jumlah", "Peminjam", "Keperluan", "Mulai", "Selesai", "Status", "Lingkup", "Kondisi Kembali", "Diputuskan Oleh"],
        rows: p.map((x, i) => [i + 1, x.jenis, x.asset?.name ?? x.ruang ?? "", x.jumlah, x.peminjamNama,
          x.keperluan, tgl(x.mulai), tgl(x.selesai), x.status, x.lingkup, x.kondisiKembali ?? "", x.diputuskanOleh ?? ""]),
      };
    },
  },
  "sarpras-perawatan": {
    judul: "Jadwal Perawatan",
    boleh: bolehSarpras,
    susun: async () => {
      const j = await prisma.jadwalPerawatan.findMany({
        include: { asset: { select: { name: true } }, _count: { select: { riwayat: true } } },
        orderBy: { berikutnya: "asc" },
      });
      return {
        headers: ["No", "Judul", "Aset", "Lokasi", "Interval (hari)", "Perawatan Berikutnya", "Terakhir", "Penanggung Jawab", "Lingkup", "Aktif", "Jumlah Riwayat", "Catatan"],
        rows: j.map((x, i) => [i + 1, x.judul, x.asset?.name ?? "", x.lokasi ?? "", x.intervalHari,
          tgl(x.berikutnya), tgl(x.terakhir), x.penanggungJawab ?? "", x.lingkup, x.aktif ? "Ya" : "Tidak",
          x._count.riwayat, x.catatan ?? ""]),
      };
    },
  },
  "kesehatan-siswa": {
    judul: "Pemeriksaan Kesehatan",
    boleh: bolehUks,
    susun: async () => {
      const p = await prisma.pemeriksaanKesehatan.findMany({ orderBy: { tanggal: "desc" }, take: 5000 });
      const siswa = await prisma.student.findMany({
        where: { id: { in: [...new Set(p.map(x => x.studentId))] } },
        select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
      });
      const peta = new Map(siswa.map(s => [s.id, s]));
      return {
        headers: ["No", "Tanggal", "Nama", "NIS", "Kelas", "Tinggi (cm)", "Berat (kg)", "IMT", "Status Gizi", "Tensi", "Penglihatan", "Diperiksa Oleh", "Catatan"],
        rows: p.map((x, i) => {
          const s = peta.get(x.studentId);
          const g = hitungGizi(x.tinggiCm, x.beratKg);
          return [i + 1, tgl(x.tanggal), s?.user.name ?? "", s?.nis ?? "", s?.class?.name ?? "",
            x.tinggiCm, x.beratKg, x.imt ?? g.imt, x.statusGizi ?? g.status ?? "",
            x.tensi ?? "", x.penglihatan ?? "", x.olehNama, x.catatan ?? ""];
        }),
      };
    },
  },
};

export const KUNCI_EKSPOR = Object.keys(EKSPOR);
