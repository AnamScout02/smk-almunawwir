import "server-only";
import { prisma } from "@/lib/prisma";
import { cekLibur } from "@/lib/hari-libur";
import { catatPresensiPegawai } from "@/lib/presensi-pegawai";

/**
 * KEHADIRAN DI KEGIATAN SEKOLAH IKUT MENGISI ABSENSI HARIAN (30 September 2026).
 *
 * Siswa yang hadir di upacara/MPLS/pelatihan jelas ada di sekolah hari itu, jadi tidak masuk akal
 * kalau absensi hariannya tetap kosong. Aturannya PERSIS sama dengan pindai kartu gerbang
 * (CLAUDE.md #33) dan presensi pegawai (#52):
 *
 *  - Hanya MENGISI kalau hari itu BELUM ada catatan sama sekali. Keputusan wali kelas
 *    (IZIN/SAKIT/ALPHA yang sudah diisi manual) TIDAK PERNAH ditimpa.
 *  - Hari libur dilewati (`cekLibur`) — kegiatan akhir pekan tidak membuat absensi hari libur.
 *  - Gagal di sini TIDAK BOLEH menggagalkan presensi kegiatannya; pemanggil membungkus dengan catch.
 *
 * Tanggal memakai pola string `YYYY-MM-DD` yang sama dengan seluruh Attendance lain di aplikasi ini.
 */
export async function hadirkanAbsensiHarian(userIds: string[], tanggalIso: string): Promise<{ siswa: number; pegawai: number }> {
  if (!userIds.length) return { siswa: 0, pegawai: 0 };
  if (await cekLibur(tanggalIso).catch(() => null)) return { siswa: 0, pegawai: 0 };

  const awal = new Date(`${tanggalIso}T00:00:00.000Z`);
  const akhir = new Date(awal.getTime() + 86_400_000);

  const orang = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, student: { select: { id: true, studentStatus: true } } },
  });

  const siswaIds = orang
    .filter(u => u.role === "STUDENT" && u.student && u.student.studentStatus === "AKTIF")
    .map(u => u.student!.id);
  let siswa = 0;
  if (siswaIds.length) {
    const sudah = await prisma.attendance.findMany({
      where: { studentId: { in: siswaIds }, date: { gte: awal, lt: akhir } },
      select: { studentId: true },
    });
    const punya = new Set(sudah.map(x => x.studentId));
    const baru = siswaIds.filter(id => !punya.has(id));
    if (baru.length) {
      // Attendance TIDAK punya unique constraint (CLAUDE.md), jadi createMany aman hanya karena
      // sudah disaring di atas — jangan mengandalkan skipDuplicates.
      await prisma.attendance.createMany({ data: baru.map(studentId => ({ studentId, date: awal, status: "HADIR" })) });
      siswa = baru.length;
    }
  }

  // Guru & staf lewat satu pintu presensi pegawai supaya aturan jam masuk/pulang & status TU yang
  // sudah ditetapkan tetap dihormati. Fungsi itu SELALU bekerja pada hari ini (WIB), jadi presensi
  // kegiatan hari lampau sengaja tidak menyentuh StaffAttendance — mengisi hari lampau itu wewenang TU.
  let pegawai = 0;
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  if (tanggalIso === hariIni) {
    for (const u of orang.filter(x => x.role === "TEACHER" || x.role === "TAS")) {
      const h = await catatPresensiPegawai(u.id, "KEGIATAN").catch(() => null);
      if (h && (h.hasil === "MASUK" || h.hasil === "PULANG")) pegawai++;
    }
  }
  return { siswa, pegawai };
}
