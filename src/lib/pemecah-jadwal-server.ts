import "server-only";
import { prisma } from "@/lib/prisma";
import { weekGroupForClass } from "@/lib/schedule-week";
import { PapanJadwal, tambahJam, uraiBentrok, type Langkah, type Minggu, type Sel } from "@/lib/pemecah-jadwal";

/** Pemuat & penerap untuk Pemecah Jadwal (src/lib/pemecah-jadwal.ts). Yang ditulis ke jadwal HANYA lewat `terapkanUsulan`,
 *  dan caranya menjaga id baris jadwal sebisa mungkin: `TeacherScheduleAttendance` (catatan guru piket) menggantung pada
 *  `Schedule.id` dengan hapus-berantai, jadi menghapus-lalu-membuat ulang baris akan menghapus riwayat kehadiran guru. */
export const HARI = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const LABEL_HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export async function muatPapan() {
  const [penugasan, jadwal, jam, kelas] = await Promise.all([
    prisma.teachingAssignment.findMany({ include: { subject: true, class: { select: { name: true, grade: true } }, teacher: { select: { user: { select: { name: true } } } }, preferences: true } }),
    prisma.schedule.findMany({ where: { scheduleType: "BLOK" }, select: { id: true, classId: true, subject: true, teacherId: true, day: true, startTime: true, endTime: true, weekType: true } }),
    prisma.schoolPeriod.findMany({ where: { isBreak: false }, orderBy: [{ day: "asc" }, { order: "asc" }] }),
    prisma.class.findMany({ select: { id: true, name: true, grade: true } }),
  ]);
  const jamHari = HARI.map(h => jam.filter(p => p.day === h).map(p => ({ mulai: p.startTime, selesai: p.endTime })));
  const papan = new PapanJadwal(jamHari.map(j => j.length));
  const tugas = new Map(penugasan.map(a => [`${a.classId}|${a.subject.name}`, a]));
  const kelasPeta = new Map(kelas.map(k => [k.id, k]));
  const guruNama = new Map(penugasan.map(a => [a.teacherId, a.teacher.user.name]));
  const tidakCocok: string[] = [];
  for (const s of jadwal) {
    const d = HARI.indexOf(s.day);
    const daftar = d < 0 ? [] : jamHari[d].map((j, pi) => ({ j, pi })).filter(x => x.j.mulai >= s.startTime && x.j.mulai < s.endTime);
    if (!daftar.length) { tidakCocok.push(s.id); continue; }
    const a = tugas.get(`${s.classId}|${s.subject}`), k = kelasPeta.get(s.classId);
    for (const { j, pi } of daftar) {
      const tetap = !!a?.preferences.some(p => p.day === s.day && (p.weekType === "SEMUA" || p.weekType === s.weekType) && (() => {
        const mulaiIdx = jamHari[d].findIndex(x => x.mulai === p.startTime); return mulaiIdx >= 0 && pi >= mulaiIdx && pi < mulaiIdx + p.hours;
      })());
      papan.pasang({
        id: `${s.id}#${pi}`, rowId: s.id, classId: s.classId, teacherId: s.teacherId, subject: s.subject, week: s.weekType as Minggu, day: d, pi,
        tetap, maxShared: a?.subject.maxSharedTeacher ?? 1, rotasi: k?.grade === 10 || k?.grade === 11,
      });
      void j;
    }
  }
  // Jam yang belum terjadwal per penugasan (aturan sama dengan /api/admin/schedules/unscheduled).
  const ada = new Map<string, number>();
  for (const s of papan.sel.values()) ada.set(`${s.classId}|${s.subject}`, (ada.get(`${s.classId}|${s.subject}`) ?? 0) + 1);
  const kurang = penugasan.map(a => {
    const rotasi = a.class.grade === 10 || a.class.grade === 11, butuh = a.subject.hoursPerWeek * (rotasi ? 2 : 1);
    const utama: Minggu = !rotasi ? "SEMUA" : a.subject.weekGroup === weekGroupForClass(a.class.grade, "A") ? "A" : "B";
    return { id: a.id, classId: a.classId, kelas: a.class.name, mapel: a.subject.name, teacherId: a.teacherId, guru: a.teacher.user.name, maxShared: a.subject.maxSharedTeacher, rotasi, utama, kurang: butuh - (ada.get(`${a.classId}|${a.subject.name}`) ?? 0) };
  }).filter(x => x.kurang > 0);
  const namaKelas = (id: string) => kelasPeta.get(id)?.name ?? "—";
  const tempat = (t: { week: Minggu; day: number; pi: number }) => `${LABEL_HARI[t.day]} jam ke-${t.pi + 1} (${jamHari[t.day][t.pi]?.mulai ?? "?"})${t.week === "SEMUA" ? "" : ` · minggu ${t.week === "A" ? 1 : 2}`}`;
  const uraikan = (l: Langkah) => ({
    jenis: l.jenis, kelas: namaKelas(l.sel.classId), mapel: l.sel.subject, guru: l.sel.teacherId ? guruNama.get(l.sel.teacherId) ?? "—" : "—",
    dari: l.dari ? tempat(l.dari) : null, ke: tempat(l.ke),
    // Bahan untuk menerapkan: baris asal + jam asal, dan tempat tujuan.
    data: { rowId: l.sel.rowId, classId: l.sel.classId, teacherId: l.sel.teacherId, subject: l.sel.subject, dari: l.dari, ke: l.ke },
  });
  return { papan, kurang, jamHari, namaKelas, guruNama, uraikan, tidakCocok };
}
export type LangkahUrai = ReturnType<Awaited<ReturnType<typeof muatPapan>>["uraikan"]>;

/** Ringkasan keadaan jadwal: jam belum terjadwal dan bentrok guru yang tidak diizinkan. */
export async function keadaanJadwal() {
  const m = await muatPapan();
  const bentrok = m.papan.bentrok().map(([a, b]) => ({
    kunci: `${a.id}~${b.id}`, guru: a.teacherId ? m.guruNama.get(a.teacherId) ?? "—" : "—", hari: LABEL_HARI[a.day], jam: m.jamHari[a.day][a.pi]?.mulai ?? "",
    a: { kelas: m.namaKelas(a.classId), mapel: a.subject, minggu: a.week, tetap: a.tetap }, b: { kelas: m.namaKelas(b.classId), mapel: b.subject, minggu: b.week, tetap: b.tetap },
  })).sort((x, y) => x.guru.localeCompare(y.guru) || x.hari.localeCompare(y.hari) || x.jam.localeCompare(y.jam));
  return { kurang: m.kurang.map(k => ({ id: k.id, kelas: k.kelas, mapel: k.mapel, guru: k.guru, kurang: k.kurang })), bentrok, selTotal: m.papan.sel.size };
}

/** Carikan tempat untuk jam yang belum terjadwal (`tugasId` kosong = semuanya) dan/atau uraikan bentrok (`bentrok` =
 *  daftar kunci, "semua" = semuanya). TIDAK menulis apa pun — mengembalikan langkah untuk ditinjau. */
export async function susunUsulan(o: { tugasId?: string | null; isiKurang: boolean; bentrok: string[] | "semua" | null }) {
  const m = await muatPapan();
  const selAwal = m.papan.sel.size, tabrakanAwal = m.papan.tabrakanKelas();
  const langkah: Langkah[] = [], gagal: string[] = [];
  if (o.isiKurang) {
    for (const k of m.kurang.filter(x => !o.tugasId || x.id === o.tugasId)) {
      const h = tambahJam(m.papan, { classId: k.classId, teacherId: k.teacherId, subject: k.mapel, maxShared: k.maxShared, rotasi: k.rotasi, mingguUtama: k.utama }, k.kurang);
      langkah.push(...h.langkah);
      if (h.sisa > 0) gagal.push(`${k.kelas} — ${k.mapel} (${k.guru}): ${h.sisa} jam tetap tidak muat walau sudah dicoba menggeser sampai dua tingkat.`);
    }
  }
  let teruraikan = 0, sisaBentrok = 0;
  if (o.bentrok) {
    const sasaran = m.papan.bentrok().filter(([a, b]) => o.bentrok === "semua" || (o.bentrok as string[]).includes(`${a.id}~${b.id}`));
    for (const [a, b] of sasaran) {
      // Rantai sebelumnya bisa sudah mengurai pasangan ini.
      if (!m.papan.sel.has(a.id) || !m.papan.sel.has(b.id) || !m.papan.penghalang(a, a.week, a.day, a.pi, a.id).some(x => x.id === b.id)) { teruraikan++; continue; }
      const h = uraiBentrok(m.papan, a, b);
      if (h) { langkah.push(...h); teruraikan++; } else sisaBentrok++;
    }
  }
  // Pemeriksaan mandiri sebelum usulan diperlihatkan: tidak ada jam yang hilang, dan tidak ada kelas yang jadi dobel.
  const baru = langkah.filter(l => l.jenis === "BARU").length;
  const sah = m.papan.sel.size === selAwal + baru && m.papan.tabrakanKelas() <= tabrakanAwal;
  return { langkah: langkah.map(m.uraikan), gagal, teruraikan, sisaBentrok, bentrokSesudah: m.papan.bentrok().length, sah };
}

/** Terapkan langkah usulan ke jadwal. Tiap langkah diperiksa ulang terhadap keadaan SEKARANG (jadwal bisa berubah sejak
 *  usulan dibuat): baris asal harus masih ada dan masih memuat jam itu; bila tidak, seluruh penerapan dibatalkan. */
/** Langkah datang dari browser, jadi DIPERIKSA ULANG di sini: diterapkan ke papan yang baru dimuat, lalu hasil akhirnya
 *  tidak boleh menambah kelas dobel maupun bentrok guru, dan jam BARU harus milik penugasan yang memang masih kurang. */
export async function periksaUsulan(langkah: LangkahUrai["data"][]): Promise<string | null> {
  if (!Array.isArray(langkah) || !langkah.length || langkah.length > 400) return "Usulan kosong atau terlalu panjang.";
  const m = await muatPapan();
  const tabrakan = m.papan.tabrakanKelas(), bentrok = m.papan.bentrok().length;
  const sisaKurang = new Map(m.kurang.map(k => [`${k.classId}|${k.mapel}|${k.teacherId}`, k]));
  const pindah: Sel[] = [];
  for (const l of langkah) {
    if (!l?.ke || !(l.ke.day >= 0 && l.ke.day < 6) || !(l.ke.pi >= 0 && l.ke.pi < m.papan.jamPerHari[l.ke.day]) || !["A", "B", "SEMUA"].includes(l.ke.week)) return "Tempat tujuan tidak sah.";
    if (l.dari && l.rowId) {
      const s = m.papan.sel.get(`${l.rowId}#${l.dari.pi}`);
      if (!s || s.day !== l.dari.day || s.week !== l.dari.week) return "Jadwal sudah berubah sejak usulan dibuat — susun ulang usulannya.";
      if (s.tetap) return "Usulan memindahkan jam yang dipatok lewat Preferensi Hari/Jam.";
      if (s.rotasi ? l.ke.week === "SEMUA" : l.ke.week !== "SEMUA") return "Minggu tujuan tidak cocok dengan kelasnya.";
      m.papan.cabut(s); s.week = l.ke.week; s.day = l.ke.day; s.pi = l.ke.pi; pindah.push(s);
    } else {
      const k = sisaKurang.get(`${l.classId}|${l.subject}|${l.teacherId}`);
      if (!k || k.kurang <= 0) return "Usulan menambah jam untuk penugasan yang tidak kurang jamnya.";
      if (k.rotasi ? l.ke.week === "SEMUA" : l.ke.week !== "SEMUA") return "Minggu tujuan tidak cocok dengan kelasnya.";
      k.kurang--;
      pindah.push({ id: m.papan.idBaru(), rowId: null, classId: k.classId, teacherId: k.teacherId, subject: k.mapel, week: l.ke.week, day: l.ke.day, pi: l.ke.pi, tetap: false, maxShared: k.maxShared, rotasi: k.rotasi });
    }
  }
  for (const s of pindah) m.papan.pasang(s);
  if (m.papan.tabrakanKelas() > tabrakan) return "Usulan membuat satu kelas punya dua pelajaran di jam yang sama.";
  if (m.papan.bentrok().length > bentrok) return "Usulan menambah bentrok guru.";
  return null;
}

export async function terapkanUsulan(langkah: LangkahUrai["data"][]) {
  const jam = await prisma.schoolPeriod.findMany({ where: { isBreak: false }, orderBy: [{ day: "asc" }, { order: "asc" }] });
  const jamHari = HARI.map(h => jam.filter(p => p.day === h).map(p => ({ mulai: p.startTime, selesai: p.endTime })));
  return prisma.$transaction(async tx => {
    let dibuat = 0, diubah = 0;
    for (const l of langkah) {
      const tujuan = jamHari[l.ke.day]?.[l.ke.pi];
      if (!tujuan) throw new Error("Jam tujuan tidak ada di Kerangka Jam Pelajaran.");
      if (l.dari && l.rowId) {
        const asal = jamHari[l.dari.day]?.[l.dari.pi];
        // Baris dicari dari ISINYA (kelas, mapel, hari, minggu, jam), bukan dari id: langkah sebelumnya dalam usulan yang
        // sama bisa sudah membelah baris multi-jam itu, sehingga jam ini kini berada di baris lain.
        const r = asal ? await tx.schedule.findFirst({ where: { classId: l.classId, subject: l.subject, day: HARI[l.dari.day], weekType: l.dari.week, scheduleType: "BLOK", startTime: { lte: asal.mulai }, endTime: { gt: asal.mulai } } }) : null;
        if (!r || !asal) throw new Error("Jadwal sudah berubah sejak usulan dibuat — susun ulang usulannya.");
        const satuJam = r.startTime === asal.mulai && r.endTime <= asal.selesai;
        if (satuJam) {
          // Baris hanya memuat jam ini → dipindah di tempat (id tetap, riwayat piket ikut).
          await tx.schedule.update({ where: { id: r.id }, data: { day: HARI[l.ke.day], startTime: tujuan.mulai, endTime: tujuan.selesai, weekType: l.ke.week } });
          diubah++;
        } else {
          // Baris memuat beberapa jam → jam ini dilepas dari barisnya (baris lama tetap, dipendekkan/dibelah), lalu dibuat baris baru.
          if (r.startTime === asal.mulai) await tx.schedule.update({ where: { id: r.id }, data: { startTime: jamHari[l.dari.day][l.dari.pi + 1]?.mulai ?? asal.selesai } });
          else if (r.endTime <= asal.selesai) await tx.schedule.update({ where: { id: r.id }, data: { endTime: jamHari[l.dari.day][l.dari.pi - 1]?.selesai ?? asal.mulai } });
          else {
            const ekorMulai = jamHari[l.dari.day][l.dari.pi + 1]?.mulai ?? asal.selesai;
            await tx.schedule.update({ where: { id: r.id }, data: { endTime: jamHari[l.dari.day][l.dari.pi - 1]?.selesai ?? asal.mulai } });
            await tx.schedule.create({ data: { classId: r.classId, teacherId: r.teacherId, subject: r.subject, day: r.day, startTime: ekorMulai, endTime: r.endTime, room: r.room, generated: r.generated, weekType: r.weekType, scheduleType: "BLOK" } });
          }
          await tx.schedule.create({ data: { classId: r.classId, teacherId: r.teacherId, subject: r.subject, day: HARI[l.ke.day], startTime: tujuan.mulai, endTime: tujuan.selesai, room: r.room, generated: true, weekType: l.ke.week, scheduleType: "BLOK" } });
          diubah++;
        }
      } else {
        await tx.schedule.create({ data: { classId: l.classId, teacherId: l.teacherId, subject: l.subject, day: HARI[l.ke.day], startTime: tujuan.mulai, endTime: tujuan.selesai, generated: true, weekType: l.ke.week, scheduleType: "BLOK" } });
        dibuat++;
      }
    }
    return { dibuat, diubah };
  });
}
