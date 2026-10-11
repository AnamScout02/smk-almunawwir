import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { cekLibur } from "@/lib/hari-libur";

/** KEHADIRAN GURU TERPADU (18 September 2026) — menyandingkan EMPAT lapisan yang selama ini
 * berdiri sendiri-sendiri supaya bisa saling memeriksa:
 *
 *   StaffAttendance            hadir di sekolah?      diisi TU / pindai QR gerbang / pindai kartu
 *   TeacherScheduleAttendance  masuk kelas per jam?   diisi guru piket (Buku Piket)
 *   TeachingJournal            mengajar apa?          diisi guru yang bersangkutan
 *   DutyAttendance             petugas piket hadir?   diisi Penjamin Mutu
 *
 * Berkas ini TIDAK menulis apa pun — hanya membaca & membandingkan. Semua perbaikan data tetap
 * lewat pemiliknya masing-masing (aturan yang sama dengan CLAUDE.md #33: mesin mengusulkan,
 * manusia memutuskan). */

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const TIDAK_HADIR = ["IZIN", "SAKIT", "DINAS_LUAR", "CUTI", "ALPHA"];

export type JenisTemuan =
  | "HADIR_TAPI_ALPHA_DI_KELAS"
  | "TIDAK_HADIR_TAPI_ADA_JURNAL"
  | "PIKET_ALPHA_TAPI_ADA_JURNAL"
  | "ALPHA_SEHARIAN_TANPA_CATATAN_TU"
  | "BLOK_BELUM_DICATAT_PIKET";

export const KETERANGAN_TEMUAN: Record<JenisTemuan, { judul: string; jelas: string; berat: "tinggi" | "sedang" | "rendah" }> = {
  HADIR_TAPI_ALPHA_DI_KELAS: {
    judul: "Hadir di sekolah, tetapi ada jam yang kosong",
    jelas: "Tercatat masuk di gerbang/TU, namun guru piket mencatat ALPHA pada jam pelajarannya.",
    berat: "tinggi",
  },
  TIDAK_HADIR_TAPI_ADA_JURNAL: {
    judul: "Tercatat tidak hadir, tetapi jurnalnya terisi",
    jelas: "TU mencatat izin/sakit/dinas/alpha, tetapi ada Jurnal Mengajar pada tanggal yang sama — kemungkinan salah tanggal.",
    berat: "sedang",
  },
  PIKET_ALPHA_TAPI_ADA_JURNAL: {
    judul: "Piket mencatat ALPHA, guru mengisi jurnal",
    jelas: "Dua catatan bertolak belakang untuk hari yang sama — perlu klarifikasi Penjamin Mutu.",
    berat: "sedang",
  },
  ALPHA_SEHARIAN_TANPA_CATATAN_TU: {
    judul: "Alpha di semua jam, belum ada catatan TU",
    jelas: "Seluruh jam mengajarnya ALPHA sementara Presensi Pegawai hari itu kosong — usulkan ke TU untuk ditetapkan.",
    berat: "tinggi",
  },
  BLOK_BELUM_DICATAT_PIKET: {
    judul: "Ada jam yang belum dicatat piket",
    jelas: "Bukan masalah guru — jam ini tidak dihitung ke skor kedisiplinan sampai piket mengisinya.",
    berat: "rendah",
  },
};

export interface BlokKelas {
  kelas: string;
  mapel: string;
  jam: string;
  status: string;
  adaTugas: boolean | null;
  catatan: string | null;
}

export interface BarisKehadiranGuru {
  userId: string;
  nama: string;
  nip: string | null;
  tanggal: string; // YYYY-MM-DD
  harian: { status: string; jamMasuk: string | null; jamPulang: string | null; keterangan: string | null; sumber: string | null; pulangPerkiraan: boolean } | null;
  blok: BlokKelas[];
  blokSeharusnya: number;
  piket: { status: string; catatan: string | null } | null;
  jurnal: number;
  temuan: JenisTemuan[];
}

/** Tingkat kelas yang ikut dipantau piket — SiteSetting `kedisiplinan.tingkat` (mis. "10,11").
 * Dulu angkanya tertulis mati `grade IN (10,11)` di route piket & leaderboard. Kelas XII memang
 * sengaja dikecualikan selama semester ini karena sedang PKL (keterangan user 18 Sep 2026), tapi
 * itu keadaan yang berubah tiap semester — jadi jadikan setelan, bukan keputusan yang terkubur
 * di kode. */
export async function cakupanTingkat(): Promise<number[]> {
  const s = await getSettings(["kedisiplinan.tingkat"]).catch(() => ({ "kedisiplinan.tingkat": "10,11" }));
  const angka = (s["kedisiplinan.tingkat"] ?? "10,11")
    .split(",")
    .map(v => Number(v.trim()))
    .filter(v => v === 10 || v === 11 || v === 12);
  return angka.length ? [...new Set(angka)] : [10, 11];
}

/** Daftar tanggal (tanpa hari libur) dari `dari` s/d `sampai`, maksimal 31 hari. */
async function rentangHariSekolah(dari: string, sampai: string): Promise<Date[]> {
  const mulai = new Date(`${dari}T00:00:00Z`);
  const akhir = new Date(`${sampai}T00:00:00Z`);
  const keluar: Date[] = [];
  for (let t = mulai.getTime(); t <= akhir.getTime() && keluar.length < 31; t += 86400000) {
    const d = new Date(t);
    const libur = await cekLibur(d.toISOString().slice(0, 10)).catch(() => null);
    if (libur) continue;
    keluar.push(d);
  }
  return keluar;
}

/** Susun baris kehadiran guru per orang per tanggal, lengkap dengan temuan silang antar lapisan. */
export async function susunKehadiranGuru(opsi: { dari: string; sampai: string; userId?: string }): Promise<BarisKehadiranGuru[]> {
  const tanggal = await rentangHariSekolah(opsi.dari, opsi.sampai);
  if (tanggal.length === 0) return [];
  const awal = tanggal[0];
  const akhir = new Date(tanggal[tanggal.length - 1].getTime() + 86400000);
  const tingkat = await cakupanTingkat();

  const [pegawai, harian, blok, jurnal, piket] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["TEACHER", "TAS"] }, ...(opsi.userId ? { id: opsi.userId } : {}) },
      select: { id: true, name: true, teacher: { select: { id: true, nip: true, teacherStatus: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.staffAttendance.findMany({
      where: { tanggal: { gte: awal, lt: akhir }, ...(opsi.userId ? { userId: opsi.userId } : {}) },
      select: { userId: true, tanggal: true, status: true, jamMasuk: true, jamPulang: true, keterangan: true, sumber: true, pulangPerkiraan: true },
    }),
    prisma.teacherScheduleAttendance.findMany({
      where: { date: { gte: awal, lt: akhir } },
      select: {
        date: true, status: true, hasTugas: true, notes: true,
        schedule: {
          select: {
            subject: true, startTime: true, endTime: true,
            class: { select: { name: true } },
            teacher: { select: { userId: true } },
          },
        },
      },
    }),
    prisma.teachingJournal.findMany({
      where: { date: { gte: awal, lt: akhir } },
      select: { date: true, teacher: { select: { userId: true } } },
    }),
    prisma.dutyAttendance.findMany({
      where: { date: { gte: awal, lt: akhir }, ...(opsi.userId ? { userId: opsi.userId } : {}) },
      select: { userId: true, date: true, status: true, notes: true },
    }),
  ]);

  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const kunci = (u: string, d: Date) => `${u}|${iso(d)}`;

  const petaHarian = new Map(harian.map(h => [kunci(h.userId, h.tanggal), h]));
  const petaPiket = new Map(piket.map(p => [kunci(p.userId, p.date), p]));
  const petaJurnal = new Map<string, number>();
  for (const j of jurnal) {
    if (!j.teacher?.userId) continue;
    const k = kunci(j.teacher.userId, j.date);
    petaJurnal.set(k, (petaJurnal.get(k) ?? 0) + 1);
  }
  const petaBlok = new Map<string, BlokKelas[]>();
  for (const b of blok) {
    const uid = b.schedule.teacher?.userId;
    if (!uid) continue;
    const k = kunci(uid, b.date);
    const daftar = petaBlok.get(k) ?? [];
    daftar.push({
      kelas: b.schedule.class.name,
      mapel: b.schedule.subject,
      jam: `${b.schedule.startTime}–${b.schedule.endTime}`,
      status: b.status,
      adaTugas: b.hasTugas,
      catatan: b.notes,
    });
    petaBlok.set(k, daftar);
  }

  // Berapa blok yang SEHARUSNYA dicatat piket tiap guru tiap tanggal (untuk temuan "belum dicatat").
  const petaSeharusnya = new Map<string, number>();
  for (const d of tanggal) {
    const hari = HARI[new Date(d.getTime() + 7 * 3600_000).getUTCDay()];
    const weekType = await getWeekTypeForDate(d).catch(() => "SEMUA");
    const jadwal = await prisma.schedule.findMany({
      where: { day: hari, scheduleType: "BLOK", teacherId: { not: null }, class: { grade: { in: tingkat } } },
      select: { id: true, classId: true, subject: true, startTime: true, endTime: true, weekType: true, teacher: { select: { userId: true } } },
      orderBy: { startTime: "asc" },
    }).catch(() => []);
    const dipakai = jadwal.filter(s => weekTypesOverlap(s.weekType, weekType));
    const perGuru = new Map<string, typeof dipakai>();
    for (const s of dipakai) {
      const uid = s.teacher?.userId;
      if (!uid) continue;
      perGuru.set(uid, [...(perGuru.get(uid) ?? []), s]);
    }
    for (const [uid, daftar] of perGuru) {
      const blokGuru = groupConsecutiveSchedules(daftar, s => `${s.classId}|${s.subject}`);
      petaSeharusnya.set(kunci(uid, d), blokGuru.length);
    }
  }

  const hasil: BarisKehadiranGuru[] = [];
  for (const p of pegawai) {
    if (p.teacher && p.teacher.teacherStatus && p.teacher.teacherStatus !== "AKTIF") continue;
    for (const d of tanggal) {
      const k = kunci(p.id, d);
      const h = petaHarian.get(k) ?? null;
      const b = petaBlok.get(k) ?? [];
      const jml = petaJurnal.get(k) ?? 0;
      const pk = petaPiket.get(k) ?? null;
      const seharusnya = petaSeharusnya.get(k) ?? 0;
      // Baris tanpa jejak apa pun tidak perlu ditampilkan — hanya menambah panjang tabel.
      if (!h && b.length === 0 && jml === 0 && !pk && seharusnya === 0) continue;

      const temuan: JenisTemuan[] = [];
      const adaAlpha = b.some(x => x.status === "ALPHA");
      if (h?.status === "HADIR" && adaAlpha) temuan.push("HADIR_TAPI_ALPHA_DI_KELAS");
      if (h && TIDAK_HADIR.includes(h.status) && jml > 0) temuan.push("TIDAK_HADIR_TAPI_ADA_JURNAL");
      if (adaAlpha && jml > 0) temuan.push("PIKET_ALPHA_TAPI_ADA_JURNAL");
      if (!h && b.length > 0 && b.every(x => x.status === "ALPHA")) temuan.push("ALPHA_SEHARIAN_TANPA_CATATAN_TU");
      if (seharusnya > b.length) temuan.push("BLOK_BELUM_DICATAT_PIKET");

      hasil.push({
        userId: p.id,
        nama: p.name,
        nip: p.teacher?.nip ?? null,
        tanggal: iso(d),
        harian: h ? { status: h.status, jamMasuk: h.jamMasuk, jamPulang: h.jamPulang, keterangan: h.keterangan, sumber: h.sumber, pulangPerkiraan: h.pulangPerkiraan } : null,
        blok: b,
        blokSeharusnya: seharusnya,
        piket: pk ? { status: pk.status, catatan: pk.notes } : null,
        jurnal: jml,
        temuan,
      });
    }
  }
  return hasil;
}
