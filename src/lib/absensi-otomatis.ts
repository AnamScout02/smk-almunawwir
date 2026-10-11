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
 * ABSEN KELAS MENGIKUTI ABSEN KEGIATAN (10 Oktober 2026, keputusan user: "selama mereka ikut kegiatan, absen kelas
 * tetap sesuai dengan absen kegiatan saja"). Keterangan presensi kegiatan ikut terbawa: "Izin" → IZIN, "Sakit" → SAKIT,
 * selain itu (hadir biasa, terlambat, dispensasi) → HADIR. Baris yang dibuat dari sini bertanda `sumber: "KEGIATAN"`, dan
 * HANYA baris bertanda itu yang boleh diubah/dicabut lagi saat presensi kegiatannya diubah/dihapus. Begitu wali kelas
 * menyimpan absensi kelasnya, tandanya hilang (rute absensi menghapus-lalu-menulis) — sejak itu milik wali kelas.
 *
 * Tanggal memakai pola string `YYYY-MM-DD` yang sama dengan seluruh Attendance lain di aplikasi ini.
 */
/** Status absensi harian dari keterangan presensi kegiatan. */
export function statusDariKeterangan(keterangan?: string | null): "HADIR" | "IZIN" | "SAKIT" {
  const k = (keterangan ?? "").trim().toLowerCase();
  if (/^sakit\b/.test(k)) return "SAKIT";
  if (/^i[zj]in\b/.test(k)) return "IZIN";
  return "HADIR";
}

const rentang = (iso: string) => { const awal = new Date(`${iso}T00:00:00.000Z`); return { awal, akhir: new Date(awal.getTime() + 86_400_000) }; };

async function siswaAktifDari(userIds: string[]) {
  const orang = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, role: true, student: { select: { id: true, studentStatus: true } } },
  });
  return { orang, siswaIds: orang.filter(u => u.role === "STUDENT" && u.student?.studentStatus === "AKTIF").map(u => u.student!.id) };
}

/** Tulis status ke absensi harian siswa: mengisi yang kosong, memperbarui yang ber-asal KEGIATAN, melewati isian wali. */
async function tulisDariKegiatan(siswaIds: string[], tanggalIso: string, status: string): Promise<number> {
  if (!siswaIds.length) return 0;
  const { awal, akhir } = rentang(tanggalIso);
  const sudah = await prisma.attendance.findMany({
    where: { studentId: { in: siswaIds }, date: { gte: awal, lt: akhir } },
    select: { id: true, studentId: true, status: true, sumber: true },
  });
  const per = new Map<string, typeof sudah>();
  for (const x of sudah) per.set(x.studentId, [...(per.get(x.studentId) ?? []), x]);
  const baru = siswaIds.filter(id => !per.has(id));
  // Attendance TIDAK punya unique constraint (CLAUDE.md), jadi createMany aman hanya karena sudah disaring di atas.
  if (baru.length) await prisma.attendance.createMany({ data: baru.map(studentId => ({ studentId, date: awal, status, sumber: "KEGIATAN" })) });
  const ubah = [...per.values()].filter(b => b.every(x => x.sumber === "KEGIATAN") && b.some(x => x.status !== status)).flatMap(b => b.map(x => x.id));
  if (ubah.length) await prisma.attendance.updateMany({ where: { id: { in: ubah }, sumber: "KEGIATAN" }, data: { status } });
  return baru.length + ubah.length;
}

export async function hadirkanAbsensiHarian(userIds: string[], tanggalIso: string, keterangan?: string | null): Promise<{ siswa: number; pegawai: number }> {
  if (!userIds.length) return { siswa: 0, pegawai: 0 };
  if (await cekLibur(tanggalIso).catch(() => null)) return { siswa: 0, pegawai: 0 };
  const status = statusDariKeterangan(keterangan);
  const { orang, siswaIds } = await siswaAktifDari(userIds);
  const siswa = await tulisDariKegiatan(siswaIds, tanggalIso, status);

  // Guru & staf lewat satu pintu presensi pegawai supaya aturan jam masuk/pulang & status TU yang
  // sudah ditetapkan tetap dihormati. Fungsi itu SELALU bekerja pada hari ini (WIB), jadi presensi
  // kegiatan hari lampau sengaja tidak menyentuh StaffAttendance — mengisi hari lampau itu wewenang TU.
  // Izin/sakit pegawai juga wewenang TU (lewat cuti), jadi hanya yang HADIR yang diteruskan.
  let pegawai = 0;
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  if (tanggalIso === hariIni && status === "HADIR") {
    for (const u of orang.filter(x => x.role === "TEACHER" || x.role === "TAS")) {
      const h = await catatPresensiPegawai(u.id, "KEGIATAN").catch(() => null);
      if (h && (h.hasil === "MASUK" || h.hasil === "PULANG")) pegawai++;
    }
  }
  return { siswa, pegawai };
}

/** Presensi kegiatan dihapus → absensi harian yang BERASAL dari kegiatan ikut dicabut, kecuali orangnya masih tercatat
 *  di kegiatan lain pada hari yang sama. Isian wali kelas tidak disentuh. */
export async function cabutAbsensiKegiatan(userId: string, tanggalIso: string): Promise<number> {
  const { awal, akhir } = rentang(tanggalIso);
  if (await prisma.presensiKegiatan.count({ where: { userId, tanggal: awal } })) return 0;
  const s = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (!s) return 0;
  return (await prisma.attendance.deleteMany({ where: { studentId: s.id, date: { gte: awal, lt: akhir }, sumber: "KEGIATAN" } })).count;
}

/** "TIDAK HADIR DI KEGIATAN = ALPHA DI ABSEN KELAS" — hanya lewat tombol yang ditekan panitia (tidak pernah otomatis):
 *  mengisi ALPHA untuk siswa yang hari itu BELUM punya catatan sama sekali. Yang sudah diisi wali kelas dilewati. */
export async function alphakanAbsensiHarian(userIds: string[], tanggalIso: string): Promise<number> {
  if (!userIds.length || (await cekLibur(tanggalIso).catch(() => null))) return 0;
  const { awal, akhir } = rentang(tanggalIso);
  const { siswaIds } = await siswaAktifDari(userIds);
  if (!siswaIds.length) return 0;
  const punya = new Set((await prisma.attendance.findMany({ where: { studentId: { in: siswaIds }, date: { gte: awal, lt: akhir } }, select: { studentId: true } })).map(x => x.studentId));
  const baru = siswaIds.filter(id => !punya.has(id));
  if (baru.length) await prisma.attendance.createMany({ data: baru.map(studentId => ({ studentId, date: awal, status: "ALPHA", sumber: "KEGIATAN" })) });
  return baru.length;
}

/** KELAS YANG HARI ITU IKUT KEGIATAN SEHARIAN → absensinya diambil di kegiatan, jadi pengingat & daftar "kelas belum absen"
 *  tidak menagih wali kelasnya (temuan user: LDKS kelas X). Syaratnya sengaja sempit supaya upacara satu jam tidak
 *  membungkam pengingat seharian: kegiatan DISETUJUI, untuk SISWA satu kelas utuh (bukan daftar orang per orang), dan
 *  jam hariannya minimal 4 jam. Mengembalikan peta classId → judul kegiatan. */
export async function kelasIkutKegiatan(tanggalIso: string): Promise<Map<string, string>> {
  const { awal, akhir } = rentang(tanggalIso);
  const awalWib = new Date(awal.getTime() - 7 * 3600_000), akhirWib = new Date(akhir.getTime() - 7 * 3600_000);
  const kegiatan = await prisma.kegiatan.findMany({
    where: {
      statusPersetujuan: "DISETUJUI", targetRole: { in: ["ALL", "STUDENT", "STUDENT_PARENT"] }, targetUserIds: { isEmpty: true },
      mulai: { lt: akhirWib }, OR: [{ sampaiTanggal: null, mulai: { gte: awalWib } }, { sampaiTanggal: { gte: awal } }],
    },
    select: { judul: true, mulai: true, selesai: true, sampaiTanggal: true, targetKelasIds: true, targetJurusanIds: true },
  }).catch(() => []);
  const hasil = new Map<string, string>();
  for (const k of kegiatan) {
    // Jam harian = selisih `mulai` & `selesai` (kegiatan berhari-hari: `selesai` adalah jam selesai hari pertama).
    // Hari pertama = tanggal WIB `mulai`; hari terakhir = `sampaiTanggal` (aturan sama dengan `hariKegiatan` di kegiatan-qr.ts,
    // ditulis di sini supaya modul yang dipakai penjadwal ini tidak menarik penjaga halaman).
    const pertama = new Date(k.mulai.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
    const terakhir = k.sampaiTanggal ? k.sampaiTanggal.toISOString().slice(0, 10) : pertama;
    if (tanggalIso < pertama || tanggalIso > terakhir || k.selesai.getTime() - k.mulai.getTime() < 4 * 3600_000) continue;
    const kelas = await prisma.class.findMany({
      where: { ...(k.targetKelasIds.length ? { id: { in: k.targetKelasIds } } : {}), ...(k.targetJurusanIds.length ? { majorId: { in: k.targetJurusanIds } } : {}) },
      select: { id: true },
    });
    for (const c of kelas) if (!hasil.has(c.id)) hasil.set(c.id, k.judul);
  }
  return hasil;
}
