import "server-only";
import { prisma } from "@/lib/prisma";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { groupConsecutiveSchedules } from "@/lib/schedule-grouping";
import { awalKbm, hariTanpaKbm } from "@/lib/hari-kbm";
import { pekanKini, wibIso } from "@/lib/jurnal-cepat";
import { bacaButir, kemajuanRencana } from "@/lib/cocok-materi";

/** KETERLAKSANAAN KURIKULUM (10 Oktober 2026, pilihan user) — satu baris = GURU × KELAS × MAPEL pada semester berjalan:
 *
 *   pertemuan terjadwal  dari Jadwal Pelajaran (blok berurutan = satu pertemuan), dijalankan pada tiap hari sekolah
 *                        sejak awal semester — hari libur dan hari ujian (per tingkat) tidak dihitung;
 *   jurnal terisi        Jurnal Mengajar pada kelas & mapel itu (satu per tanggal);
 *   materi               butir Prota/Promes yang tertulis di jurnal vs yang menurut pekannya sudah harus selesai.
 *
 *  BATAS YANG HARUS DIKETAHUI PEMBACA (ditulis juga di layar): jadwal yang dipakai adalah jadwal SEKARANG untuk
 *  seluruh semester — bila jadwal diganti di tengah semester, hitungan pertemuan sebelum penggantian adalah perkiraan.
 *  Dipakai Papan Keterlaksanaan, Kelengkapan Perangkat, dan Rapor Kinerja Guru — jangan menghitung ulang di tempat lain. */

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];

export interface BarisKeterlaksanaan {
  teacherId: string; guru: string; classId: string; kelas: string; tingkat: number; mapel: string;
  pertemuan: number; jp: number; jurnal: number; persen: number | null; tertinggal: number;
  jurnalTerakhir: string | null;
  rencana: { total: number; tercapai: number; seharusnya: number | null; tertinggal: number | null; berikut: string | null } | null;
}

export async function susunKeterlaksanaan(opsi: { teacherId?: string; tingkat?: number[] } = {}) {
  const hariIni = wibIso(), pk = await pekanKini(hariIni);
  const kini = new Date(Date.now() + 7 * 3600_000), menitKini = kini.getUTCHours() * 60 + kini.getUTCMinutes();
  // Dihitung sejak hari pertama sekolah benar-benar berjalan (src/lib/hari-kbm.ts), bukan sejak 1 Juli.
  const mulai = await awalKbm(pk.mulai);
  const awal = new Date(`${mulai}T00:00:00Z`), akhir = new Date(new Date(`${hariIni}T00:00:00Z`).getTime() + 86400000);
  const [jadwal, jurnal, rencana, tanpa] = await Promise.all([
    prisma.schedule.findMany({
      where: { scheduleType: "BLOK", teacherId: opsi.teacherId ?? { not: null }, ...(opsi.tingkat?.length ? { class: { grade: { in: opsi.tingkat } } } : {}) },
      select: {
        teacherId: true, classId: true, subject: true, day: true, startTime: true, endTime: true, weekType: true,
        class: { select: { name: true, grade: true } }, teacher: { select: { teacherStatus: true, user: { select: { name: true } } } },
      },
    }),
    prisma.teachingJournal.findMany({
      where: { date: { gte: awal, lt: akhir }, ...(opsi.teacherId ? { teacherId: opsi.teacherId } : {}) },
      select: { teacherId: true, classId: true, subject: true, date: true, materi: true },
    }),
    prisma.rencanaAjar.findMany({
      where: { tahunAjaran: pk.tahunAjaran, semester: pk.semester, ...(opsi.teacherId ? { teacherId: opsi.teacherId } : {}) },
      select: { teacherId: true, subject: true, tingkat: true, items: true },
    }),
    hariTanpaKbm(mulai, hariIni),
  ]);
  const aktif = jadwal.filter(s => !s.teacher?.teacherStatus || s.teacher.teacherStatus === "AKTIF");

  // Blok per (hari, jenis minggu) dihitung sekali; lalu tiap tanggal tinggal menambahkannya.
  type Blok = { kunci: string; jp: number; selesai: string; tingkat: number };
  const singgah = new Map<string, Blok[]>();
  const blokHari = (hari: string, minggu: string) => {
    const k = `${hari}|${minggu}`;
    let b = singgah.get(k);
    if (!b) {
      b = groupConsecutiveSchedules(aktif.filter(s => s.day === hari && weekTypesOverlap(s.weekType, minggu)), s => `${s.teacherId}|${s.classId}|${s.subject}`)
        .map(x => ({ kunci: `${x.first.teacherId}|${x.first.classId}|${x.first.subject}`, jp: x.items.length, selesai: x.last.endTime, tingkat: x.first.class.grade }));
      singgah.set(k, b);
    }
    return b;
  };
  const hitung = new Map<string, { pertemuan: number; jp: number }>();
  for (let t = awal.getTime(); t < akhir.getTime(); t += 86400000) {
    const d = new Date(t), tgl = d.toISOString().slice(0, 10);
    if (d.getUTCDay() === 0 || tanpa.libur(tgl)) continue;
    const minggu = await getWeekTypeForDate(d);
    for (const b of blokHari(HARI[d.getUTCDay()], minggu)) {
      if (tanpa.ujian(tgl, b.tingkat)) continue;
      // Hari ini: hanya blok yang sudah selesai — jam yang belum berlangsung bukan tunggakan.
      if (tgl === hariIni) { const [h, m] = b.selesai.split(":").map(Number); if (menitKini < h * 60 + m) continue; }
      const a = hitung.get(b.kunci) ?? { pertemuan: 0, jp: 0 };
      a.pertemuan += 1; a.jp += b.jp; hitung.set(b.kunci, a);
    }
  }

  const petaJurnal = new Map<string, { tanggal: Set<string>; materi: string[]; akhir: string }>();
  for (const j of jurnal) {
    const k = `${j.teacherId}|${j.classId}|${j.subject}`, tgl = j.date.toISOString().slice(0, 10);
    const a = petaJurnal.get(k) ?? { tanggal: new Set<string>(), materi: [], akhir: "" };
    a.tanggal.add(tgl); a.materi.push(j.materi); if (tgl > a.akhir) a.akhir = tgl;
    petaJurnal.set(k, a);
  }
  const info = new Map<string, (typeof aktif)[number]>();
  for (const s of aktif) info.set(`${s.teacherId}|${s.classId}|${s.subject}`, s);

  const baris: BarisKeterlaksanaan[] = [];
  for (const [k, s] of info) {
    const h = hitung.get(k) ?? { pertemuan: 0, jp: 0 }, j = petaJurnal.get(k);
    const butir = bacaButir(rencana.find(r => r.teacherId === s.teacherId && r.subject === s.subject && r.tingkat === s.class.grade)?.items);
    const maju = butir.length ? kemajuanRencana(butir, j?.materi ?? [], pk.pekan) : null;
    const nJurnal = j?.tanggal.size ?? 0;
    baris.push({
      teacherId: s.teacherId!, guru: s.teacher?.user.name ?? "—", classId: s.classId, kelas: s.class.name, tingkat: s.class.grade, mapel: s.subject,
      pertemuan: h.pertemuan, jp: h.jp, jurnal: nJurnal,
      persen: h.pertemuan ? Math.min(100, Math.round((nJurnal / h.pertemuan) * 100)) : null,
      tertinggal: Math.max(0, h.pertemuan - nJurnal), jurnalTerakhir: j?.akhir || null,
      rencana: maju ? { total: maju.total, tercapai: maju.tercapai, seharusnya: maju.seharusnya, tertinggal: maju.tertinggal, berikut: maju.berikut?.materi ?? null } : null,
    });
  }
  baris.sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.mapel.localeCompare(b.mapel));
  return { semester: pk.label, mulai, sampai: hariIni, pekan: pk.pekan, baris };
}

/** Ringkas per guru — dipakai Rapor Kinerja & Kelengkapan Perangkat. */
export function ringkasPerGuru(baris: BarisKeterlaksanaan[]) {
  const peta = new Map<string, { pertemuan: number; jurnal: number; kelasMapel: number; tanpaJurnal: number }>();
  for (const b of baris) {
    const a = peta.get(b.teacherId) ?? { pertemuan: 0, jurnal: 0, kelasMapel: 0, tanpaJurnal: 0 };
    a.pertemuan += b.pertemuan; a.jurnal += Math.min(b.jurnal, b.pertemuan || b.jurnal); a.kelasMapel += 1; if (b.pertemuan > 0 && b.jurnal === 0) a.tanpaJurnal += 1;
    peta.set(b.teacherId, a);
  }
  return peta;
}
