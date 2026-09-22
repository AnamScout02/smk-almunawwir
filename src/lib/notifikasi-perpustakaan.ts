import "server-only";
import { prisma } from "@/lib/prisma";
import { kirimNotifikasi, type IsiNotifikasi } from "@/lib/push-server";

type Pengirim = (n: IsiNotifikasi) => Promise<unknown>;

/** Notifikasi PORTAL PERPUSTAKAAN. Semua berkunci (lihat push-server.ts), aman dipanggil berulang. */

/** Buku pesanan anggota sudah disiapkan petugas (reservasi → TERSEDIA). */
export async function beritahuReservasiSiap(reservasiId: string, kirim: Pengirim = kirimNotifikasi) {
  const r = await prisma.bookReservation.findUnique({
    where: { id: reservasiId },
    select: { id: true, borrowerId: true, book: { select: { title: true, location: true } } },
  });
  if (!r) return;
  await kirim({
    userIds: [r.borrowerId], jenis: "PERPUS_RESERVASI", kunci: `perpus-reservasi-siap:${r.id}`,
    judul: "Buku pesanan siap diambil",
    isi: `"${r.book.title}" sudah bisa diambil di perpustakaan${r.book.location ? ` (rak ${r.book.location})` : ""}.`,
    url: "/perpustakaan", tag: `perpus-reservasi-${r.id}`,
  });
}

const HARI_MS = 86400_000;
const PENGINGAT_TERLAMBAT = [1, 3, 7];

/** Pengingat harian (dijalankan pengingat-terjadwal.ts pada jam `notifikasi.jamPerpustakaan`):
 *   - jatuh tempo BESOK → "kembalikan besok"
 *   - terlambat tepat 1, 3, atau 7 hari → "sudah terlambat N hari, denda berjalan"
 * Satu notifikasi per anggota per jenis per hari (beberapa buku digabung). */
export async function pengingatPerpustakaan(tanggalWib: string, kirim: Pengirim = kirimNotifikasi) {
  const awalHari = new Date(`${tanggalWib}T00:00:00+07:00`);
  const awalBesok = new Date(awalHari.getTime() + HARI_MS);
  const awalLusa = new Date(awalHari.getTime() + 2 * HARI_MS);

  const [jatuhTempoBesok, terlambat, denda] = await Promise.all([
    prisma.bookLoan.findMany({
      where: { status: "DIPINJAM", dueDate: { gte: awalBesok, lt: awalLusa } },
      select: { borrowerId: true, book: { select: { title: true } } },
    }),
    prisma.bookLoan.findMany({
      where: { status: "DIPINJAM", dueDate: { lt: awalHari } },
      select: { borrowerId: true, dueDate: true, book: { select: { title: true } } },
    }),
    prisma.siteSetting.findUnique({ where: { key: "perpustakaan.dendaPerHari" }, select: { value: true } }),
  ]);

  const kelompok = <T extends { borrowerId: string }>(xs: T[]) => {
    const m = new Map<string, T[]>();
    for (const x of xs) m.set(x.borrowerId, [...(m.get(x.borrowerId) ?? []), x]);
    return m;
  };
  const judul = (xs: { book: { title: string } }[]) =>
    xs.slice(0, 2).map(x => `"${x.book.title}"`).join(", ") + (xs.length > 2 ? ` dan ${xs.length - 2} buku lain` : "");

  for (const [userId, xs] of kelompok(jatuhTempoBesok)) {
    await kirim({
      userIds: [userId], jenis: "PERPUS_JATUH_TEMPO", kunci: `perpus-jatuh-tempo:${tanggalWib}:${userId}`,
      judul: "Besok batas pengembalian buku",
      isi: `Kembalikan ${judul(xs)} ke perpustakaan paling lambat besok supaya tidak terkena denda.`,
      url: "/perpustakaan/pinjaman", tag: "perpus-jatuh-tempo",
    });
  }

  const dendaPerHari = Number(denda?.value ?? 0) || 0;
  const tepat = terlambat
    .map(x => ({ ...x, hari: Math.ceil((awalHari.getTime() - x.dueDate.getTime()) / HARI_MS) }))
    .filter(x => PENGINGAT_TERLAMBAT.includes(x.hari));
  for (const [userId, xs] of kelompok(tepat)) {
    const maks = Math.max(...xs.map(x => x.hari));
    await kirim({
      userIds: [userId], jenis: "PERPUS_TERLAMBAT", kunci: `perpus-terlambat:${tanggalWib}:${userId}`,
      judul: `Buku terlambat ${maks} hari`,
      isi: `${judul(xs)} belum dikembalikan.${dendaPerHari ? ` Denda Rp${(dendaPerHari * maks).toLocaleString("id-ID")} dan terus bertambah.` : ""} Segera kembalikan ke perpustakaan.`,
      url: "/perpustakaan/pinjaman", tag: "perpus-terlambat",
    });
  }
}
