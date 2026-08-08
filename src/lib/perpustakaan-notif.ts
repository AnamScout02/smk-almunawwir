import { prisma } from "@/lib/prisma";

/** Hitung jumlah buku yang sedang dipinjam SEORANG user (siapapun rolenya — siswa/guru/pegawai)
 * dan sudah lewat tanggal jatuh tempo. Dipakai untuk badge notifikasi menu "Buku Saya" di semua
 * sidebar (Admin/TAS/Guru/Siswa) — supaya peminjam langsung sadar ada buku terlambat + denda
 * berjalan tanpa harus buka halaman Perpustakaan dulu. */
export async function getOverdueLoanCount(userId: string): Promise<number> {
  try {
    return await prisma.bookLoan.count({
      where: { borrowerId: userId, status: "DIPINJAM", dueDate: { lt: new Date() } },
    });
  } catch {
    return 0;
  }
}
