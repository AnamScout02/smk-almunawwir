import "server-only";
import { prisma } from "@/lib/prisma";
import { penerimaPengumuman } from "@/lib/pengumuman";
import { hariKegiatan, isoWib } from "@/lib/kegiatan-qr";

/**
 * KETIDAKHADIRAN KEGIATAN (30 September 2026) — permintaan user: "bisa tercatat juga ketika tidak
 * ikut, di siswa atau kesiswaan BK wali kelas".
 *
 * TIDAK ada tabel baru. Ketidakhadiran DIHITUNG dari dua hal yang sudah ada: siapa yang jadi sasaran
 * kegiatan (`penerimaPengumuman`) dikurangi siapa yang punya baris `PresensiKegiatan` pada hari itu.
 * Menyimpannya sebagai baris tersendiri akan membuat dua sumber yang bisa berbeda — mis. saat sasaran
 * kegiatan diubah setelah catatan dibuat, atau saat panitia menghapus catatan hadir.
 *
 * Hanya kegiatan yang HARINYA SUDAH LEWAT yang dihitung: kegiatan hari ini belum tentu bolos, dan
 * kegiatan yang belum berlangsung jelas bukan ketidakhadiran.
 */

/** PESERTA yang diharapkan hadir di sebuah kegiatan — dipakai daftar "Tidak Ikut Kegiatan" DAN tab "Belum Hadir"
 *  rekap panitia, supaya keduanya tidak pernah berbeda. Berbeda dari sasaran PENGUMUMAN: orang tua hanya peserta
 *  bila kegiatannya memang ditujukan ke orang tua (atau dipilih orang per orang), dan akun Admin tidak pernah —
 *  sasaran "Semua" berarti warga sekolah, akun superadmin bukan peserta kegiatan. */
export async function pesertaKegiatan(k: { targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[]; targetUserIds?: string[] }) {
  const sebutNama = (k.targetUserIds?.length ?? 0) > 0;
  const untukOrtu = sebutNama || k.targetRole === "PARENT" || k.targetRole === "STUDENT_PARENT";
  return (await penerimaPengumuman(k)).filter(s => (sebutNama || s.peran !== "Admin") && (s.peran !== "Orang tua" || untukOrtu));
}

export interface BolosKegiatan {
  kegiatanId: string;
  judul: string;
  jenis: string;
  tanggal: string; // YYYY-MM-DD WIB
}

export interface RekapBolos {
  userId: string;
  nama: string;
  kelas: string;
  jumlah: number;
  rincian: BolosKegiatan[];
}

/** Jumlah hari kegiatan yang sudah LEWAT dan dilewatkan tiap orang, dalam rentang `sejakHari` terakhir. */
export async function ketidakhadiranKegiatan(opsi: {
  /** Batasi ke orang-orang ini (siswa satu kelas, atau satu siswa). Kosong = semua sasaran. */
  userIds?: string[];
  sejakHari?: number;
}): Promise<RekapBolos[]> {
  const sejak = new Date(Date.now() - (opsi.sejakHari ?? 120) * 86_400_000);
  const kegiatan = await prisma.kegiatan.findMany({
    where: { statusPersetujuan: "DISETUJUI", mulai: { gte: sejak } },
    select: {
      id: true, judul: true, jenis: true, mulai: true, selesai: true, sampaiTanggal: true,
      targetRole: true, targetKelasIds: true, targetJurusanIds: true, targetJabatan: true, targetUserIds: true,
    },
    orderBy: { mulai: "desc" },
    take: 200,
  });
  if (!kegiatan.length) return [];

  const hariIni = isoWib(new Date());
  const presensi = await prisma.presensiKegiatan.findMany({
    where: { kegiatanId: { in: kegiatan.map(k => k.id) } },
    select: { kegiatanId: true, userId: true, tanggal: true },
  });
  const hadir = new Set(presensi.map(p => `${p.kegiatanId}|${p.userId}|${isoWib(p.tanggal)}`));
  // Hari yang punya SETIDAKNYA satu catatan hadir. Hari tanpa catatan sama sekali = presensinya memang tidak
  // dijalankan (QR tidak dibuka, tidak dicatat manual) — bukan seluruh sasaran bolos. Temuan user 5 Okt 2026:
  // kegiatan sasaran "Semua" tanpa satu pun catatan membuat ±1.800 akun × 3 hari tampil "tidak ikut".
  const hariDipresensi = new Set(presensi.map(p => `${p.kegiatanId}|${isoWib(p.tanggal)}`));

  const batas = opsi.userIds?.length ? new Set(opsi.userIds) : null;
  const kumpul = new Map<string, BolosKegiatan[]>();

  for (const k of kegiatan) {
    // Hanya hari yang BENAR-BENAR sudah lewat.
    const hari = hariKegiatan(k).filter(h => h < hariIni && hariDipresensi.has(`${k.id}|${h}`));
    if (!hari.length) continue;
    const sasaran = await pesertaKegiatan(k);
    for (const s of sasaran) {
      if (batas && !batas.has(s.userId)) continue;
      for (const h of hari) {
        if (hadir.has(`${k.id}|${s.userId}|${h}`)) continue;
        const daftar = kumpul.get(s.userId) ?? [];
        daftar.push({ kegiatanId: k.id, judul: k.judul, jenis: k.jenis, tanggal: h });
        kumpul.set(s.userId, daftar);
      }
    }
  }
  if (!kumpul.size) return [];

  const orang = await prisma.user.findMany({
    where: { id: { in: [...kumpul.keys()] } },
    select: { id: true, name: true, student: { select: { class: { select: { name: true } } } } },
  });
  const peta = new Map(orang.map(u => [u.id, u]));
  return [...kumpul.entries()]
    .map(([userId, rincian]) => ({
      userId,
      nama: peta.get(userId)?.name ?? "—",
      kelas: peta.get(userId)?.student?.class?.name ?? "",
      jumlah: rincian.length,
      rincian: rincian.sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nama.localeCompare(b.nama, "id"));
}
