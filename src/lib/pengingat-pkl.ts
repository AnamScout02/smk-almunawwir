import "server-only";
import { prisma } from "@/lib/prisma";
import type { IsiNotifikasi } from "@/lib/push-server";

/** PENGINGAT JURNAL PKL (9 Okt 2026) — dijalankan `jalankanPengingat` pada jam `notifikasi.jamPkl` (bawaan 16.30).
 *  Sasaran: siswa yang SEDANG PKL hari itu (sudah punya DUDI, status berjalan, tanggal di dalam rentang) dan belum
 *  menulis jurnal untuk hari itu. Diam di hari libur sekolah & Minggu (gerbang `cekLibur` di pemanggil).
 *  Kunci per siswa per hari → paling banyak sekali sehari, dan ikut Pratinjau lewat parameter `kirim`. */
export async function pengingatPkl(w: { tanggal: string }, opsi: { kirim: (n: IsiNotifikasi) => Promise<unknown> }) {
  const hari = new Date(`${w.tanggal}T00:00:00Z`), besok = new Date(hari.getTime() + 86_400_000);
  const pkl = await prisma.internship.findMany({
    where: {
      status: "ONGOING", mitraId: { not: null }, startDate: { lte: hari }, endDate: { gte: hari },
      student: { studentStatus: "AKTIF" },
      journal: { none: { date: { gte: hari, lt: besok } } },
    },
    select: { id: true, company: true, student: { select: { userId: true } } },
  });
  for (const p of pkl) {
    await opsi.kirim({
      userIds: [p.student.userId], jenis: "PKL", kunci: `pkl-jurnal:${p.id}:${w.tanggal}`, gantiHariIni: true,
      judul: "Jurnal PKL hari ini belum diisi", isi: `Catat kegiatanmu di ${p.company} hari ini sebelum lupa. Cukup beberapa kalimat dan satu foto.`,
      url: "/dashboard/student/pkl",
    });
  }
}
