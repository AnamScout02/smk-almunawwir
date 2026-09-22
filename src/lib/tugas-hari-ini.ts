import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { PENGATURAN_NOTIFIKASI, waktuWib } from "@/lib/pengingat-terjadwal";
import { cekLibur } from "@/lib/hari-libur";

/** TUGAS HARI INI — pita pengingat di atas halaman dashboard. Dihitung LANGSUNG dari data (bukan dari notifikasi
 * yang pernah dikirim), jadi otomatis hilang begitu tugasnya dikerjakan, dan berlaku untuk SEMUA akun tanpa perlu
 * mengaktifkan notifikasi di perangkat. Mengikuti pengaturan superadmin di Notifikasi Push: sakelar aktif, jam
 * pengingat pertama tiap jenis, hari Minggu & tanggal libur. */

export type TugasHariIni = { kunci: string; jenis: "ABSENSI" | "PIKET" | "JURNAL"; judul: string; isi: string; url: string };

const menitDari = (jam: string) => { const [h, m] = jam.split(/[:.]/).map(Number); return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : NaN; };
const jamPertama = (daftar?: string) => Math.min(...(daftar ?? "").split(/[\s,;]+/).map(menitDari).filter(Number.isFinite), Infinity);

export async function tugasHariIni(userId: string, now = new Date()): Promise<TugasHariIni[]> {
  const s = await getSettings(Object.values(PENGATURAN_NOTIFIKASI));
  if (s[PENGATURAN_NOTIFIKASI.aktif] === "0") return [];
  const w = waktuWib(now);
  if (await cekLibur(w.tanggal)) return [];

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      teacher: { select: { id: true, homeroomOf: { select: { id: true, name: true } } } },
      student: { select: { ketuaKelasOf: { select: { id: true, name: true } }, sekretarisOf: { select: { id: true, name: true } } } },
    },
  });
  if (!user) return [];
  const minggu = await getWeekTypeForDate(w.awalHari);
  const rentang = { gte: w.awalHari, lt: w.akhirHari };
  const hasil: TugasHariIni[] = [];

  // Absensi kelas (wali kelas; ketua & sekretaris kelas)
  if (w.menit >= jamPertama(s[PENGATURAN_NOTIFIKASI.jamAbsensi])) {
    const kelas = new Map([...(user.teacher?.homeroomOf ?? []), ...(user.student?.ketuaKelasOf ?? []), ...(user.student?.sekretarisOf ?? [])].map(k => [k.id, k.name]));
    if (kelas.size) {
      const jadwal = await prisma.schedule.findMany({ where: { classId: { in: [...kelas.keys()] }, day: w.hari, scheduleType: "BLOK" }, select: { classId: true, weekType: true } });
      const hariIni = [...kelas.keys()].filter(id => jadwal.some(j => j.classId === id && weekTypesOverlap(j.weekType, minggu)));
      if (hariIni.length) {
        const terisi = await prisma.attendance.findMany({ where: { date: rentang, student: { classId: { in: hariIni } } }, select: { student: { select: { classId: true } } } });
        const sudah = new Set(terisi.map(t => t.student.classId));
        for (const id of hariIni.filter(id => !sudah.has(id))) {
          hasil.push({
            kunci: `absensi:${id}`, jenis: "ABSENSI", judul: `Absensi ${kelas.get(id)} hari ini belum diisi`,
            isi: user.role === "STUDENT" ? "Isi absensi kelas lewat menu Absensi Kelas." : "Isi absensi resmi kelas wali Anda.",
            url: user.role === "STUDENT" ? "/dashboard/student/absensi-kelas" : `/dashboard/teacher/attendance/${id}`,
          });
        }
      }
    }
  }

  // Buku piket (petugas piket hari ini)
  if (w.menit >= jamPertama(s[PENGATURAN_NOTIFIKASI.jamPiket])) {
    const roster = await prisma.dutyRoster.findMany({ where: { userId, day: w.hari }, select: { weekType: true } });
    if (roster.some(r => weekTypesOverlap(r.weekType, minggu))) {
      const jadwal = await prisma.schedule.findMany({
        where: { day: w.hari, scheduleType: "BLOK", teacherId: { not: null }, class: { grade: { in: [10, 11] } } },
        select: { id: true, startTime: true, weekType: true },
      });
      const berjalan = jadwal.filter(j => weekTypesOverlap(j.weekType, minggu) && menitDari(j.startTime) <= w.menit);
      if (berjalan.length) {
        const terisi = await prisma.teacherScheduleAttendance.count({ where: { scheduleId: { in: berjalan.map(j => j.id) }, date: rentang } });
        const belum = berjalan.length - terisi;
        if (belum > 0) {
          hasil.push({
            kunci: "piket", jenis: "PIKET", judul: "Buku piket hari ini belum lengkap",
            isi: `${belum} dari ${berjalan.length} jam pelajaran yang sudah berjalan belum diisi kehadiran gurunya.`,
            url: user.role === "TEACHER" ? "/dashboard/teacher/wakasek/penjamin-mutu/kedisiplinan" : "/dashboard/admin/kedisiplinan-guru",
          });
        }
      }
    }
  }

  // Jurnal mengajar (guru yang mengajar hari ini)
  if (user.teacher && w.menit >= jamPertama(s[PENGATURAN_NOTIFIKASI.jamJurnal])) {
    const jadwal = await prisma.schedule.findMany({
      where: { teacherId: user.teacher.id, day: w.hari, scheduleType: "BLOK" },
      select: { classId: true, weekType: true, class: { select: { name: true } } },
    });
    const kelas = new Map(jadwal.filter(j => weekTypesOverlap(j.weekType, minggu)).map(j => [j.classId, j.class.name]));
    if (kelas.size) {
      const jurnal = await prisma.teachingJournal.findMany({ where: { teacherId: user.teacher.id, date: rentang }, select: { classId: true } });
      const ada = new Set(jurnal.map(j => j.classId));
      const belum = [...kelas].filter(([id]) => !ada.has(id)).map(([, nama]) => nama);
      if (belum.length) {
        hasil.push({
          kunci: "jurnal", jenis: "JURNAL", judul: "Jurnal mengajar hari ini belum diisi",
          isi: `Belum ada jurnal untuk: ${belum.slice(0, 4).join(", ")}${belum.length > 4 ? ` dan ${belum.length - 4} kelas lain` : ""}.`,
          url: "/dashboard/teacher/journal",
        });
      }
    }
  }
  return hasil;
}
