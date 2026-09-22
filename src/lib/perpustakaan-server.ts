import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";

/** Pembantu bersama PORTAL PERPUSTAKAAN (/pusat-perpustakaan petugas & /perpustakaan anggota).
 *
 * Kartu anggota = kartu tanda sekolah yang sudah dicetak (lihat /api/admin/kartu-tanda): QR/barcode berisi
 * NIS (siswa), NIP (guru), atau awalan email sebelum "@" (pegawai TAS/Admin). Pencocokan dilakukan di server —
 * dulu PerpustakaanManager memuat SELURUH daftar anggota ke browser hanya untuk mencocokkan satu kartu. */

export const PENGATURAN_PERPUS = {
  dendaPerHari: "perpustakaan.dendaPerHari",
  masaHari: "perpustakaan.masaPeminjamanHari",
  maksPinjam: "perpustakaan.maksPinjamAktif",
  maksPesan: "perpustakaan.maksReservasi",
} as const;

export async function aturanPerpustakaan() {
  const s = await getSettings(Object.values(PENGATURAN_PERPUS));
  const angka = (k: string, bawaan: number) => { const n = Number(s[k]); return Number.isFinite(n) && n >= 0 ? n : bawaan; };
  return {
    dendaPerHari: angka(PENGATURAN_PERPUS.dendaPerHari, 0),
    masaHari: angka(PENGATURAN_PERPUS.masaHari, 7) || 7,
    maksPinjam: angka(PENGATURAN_PERPUS.maksPinjam, 3) || 3,
    maksPesan: angka(PENGATURAN_PERPUS.maksPesan, 2) || 2,
  };
}

export function hitungDenda(jatuhTempo: Date, akhir: Date, dendaPerHari: number) {
  const hariTerlambat = Math.max(0, Math.ceil((akhir.getTime() - jatuhTempo.getTime()) / 86400_000));
  return { hariTerlambat, denda: hariTerlambat * dendaPerHari };
}

/** Jatuh tempo = akhir hari (23:59 WIB) setelah `masaHari` hari — bukan jam pinjam, supaya "7 hari" tidak habis siang hari. */
export function jatuhTempoBawaan(masaHari: number, dari = new Date()) {
  const wib = new Date(dari.getTime() + 7 * 3600_000);
  const tanggal = new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate() + masaHari, 16, 59, 0));
  return tanggal; // 16:59 UTC = 23:59 WIB
}

export const PILIH_ANGGOTA = {
  id: true, name: true, email: true, role: true, avatar: true,
  student: { select: { nis: true, studentStatus: true, class: { select: { name: true } } } },
  teacher: { select: { nip: true } },
} as const;

export type Anggota = { id: string; nama: string; jenis: "SISWA" | "GURU" | "PEGAWAI"; identitas: string; kelas: string | null; foto: string | null; aktif: boolean };

type BarisAnggota = {
  id: string; name: string; email: string; role: string; avatar: string | null;
  student: { nis: string; studentStatus: string | null; class: { name: string } | null } | null;
  teacher: { nip: string | null } | null;
};

export function bentukAnggota(u: BarisAnggota): Anggota {
  if (u.student) {
    return { id: u.id, nama: u.name, jenis: "SISWA", identitas: u.student.nis, kelas: u.student.class?.name ?? null, foto: u.avatar, aktif: !u.student.studentStatus || u.student.studentStatus === "AKTIF" };
  }
  if (u.teacher) return { id: u.id, nama: u.name, jenis: "GURU", identitas: u.teacher.nip ?? u.email.split("@")[0], kelas: null, foto: u.avatar, aktif: true };
  return { id: u.id, nama: u.name, jenis: "PEGAWAI", identitas: u.email.split("@")[0], kelas: null, foto: u.avatar, aktif: true };
}

/** Cari anggota dari isi kartu (NIS / NIP / awalan email pegawai). Orang tua bukan anggota perpustakaan. */
export async function cariAnggota(kode: string): Promise<Anggota | null> {
  const k = (kode ?? "").trim();
  if (!k || k.length > 100) return null;
  const u = await prisma.user.findFirst({
    where: {
      role: { not: "PARENT" },
      OR: [
        { student: { is: { nis: k } } },
        { teacher: { is: { nip: k } } },
        { role: { in: ["ADMIN", "TAS"] }, email: { startsWith: `${k}@` } },
      ],
    },
    select: PILIH_ANGGOTA,
  });
  return u ? bentukAnggota(u as BarisAnggota) : null;
}

export async function anggotaDariUserId(userId: string): Promise<Anggota | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: PILIH_ANGGOTA });
  return u && u.role !== "PARENT" ? bentukAnggota(u as BarisAnggota) : null;
}

/** Eksemplar tersedia per buku = stok − sedang dipinjam. */
export async function tersediaPerBuku(bookIds?: string[]) {
  const aktif = await prisma.bookLoan.groupBy({
    by: ["bookId"], where: { status: "DIPINJAM", ...(bookIds ? { bookId: { in: bookIds } } : {}) }, _count: { id: true },
  });
  return new Map(aktif.map(a => [a.bookId, a._count.id]));
}

/** Pinjaman aktif + tunggakan denda seorang anggota (dipakai meja sirkulasi). */
export async function ringkasanAnggota(userId: string) {
  const [aturan, pinjaman, reservasi] = await Promise.all([
    aturanPerpustakaan(),
    prisma.bookLoan.findMany({
      where: { borrowerId: userId, OR: [{ status: "DIPINJAM" }, { finePaid: false, returnDate: { not: null } }] },
      include: { book: { select: { id: true, title: true, author: true, barcode: true, coverUrl: true } } },
      orderBy: { dueDate: "asc" },
    }),
    prisma.bookReservation.findMany({
      where: { borrowerId: userId, status: { in: ["MENUNGGU", "TERSEDIA"] } },
      include: { book: { select: { id: true, title: true } } },
      orderBy: { reservedDate: "asc" },
    }),
  ]);
  const kini = new Date();
  const aktif = pinjaman.filter(p => p.status === "DIPINJAM").map(p => {
    const d = hitungDenda(p.dueDate, kini, aturan.dendaPerHari);
    return { id: p.id, buku: p.book, tanggalPinjam: p.borrowDate, jatuhTempo: p.dueDate, terlambat: d.hariTerlambat > 0, hariTerlambat: d.hariTerlambat, denda: d.denda };
  });
  const tunggakan = pinjaman.filter(p => p.status !== "DIPINJAM" && p.returnDate).map(p => ({ id: p.id, judul: p.book.title, ...hitungDenda(p.dueDate, p.returnDate!, aturan.dendaPerHari) }))
    .filter(t => t.denda > 0);
  return {
    aturan, aktif, reservasi: reservasi.map(r => ({ id: r.id, status: r.status, buku: r.book })),
    tunggakan, totalTunggakan: tunggakan.reduce((a, t) => a + t.denda, 0) + aktif.reduce((a, p) => a + p.denda, 0),
  };
}
