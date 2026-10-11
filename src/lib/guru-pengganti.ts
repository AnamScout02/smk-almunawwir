import "server-only";
import { prisma } from "@/lib/prisma";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";

/** SARAN GURU PENGGANTI (11 Okt 2026). Untuk satu tanggal: guru yang tidak masuk (Presensi Pegawai berstatus izin/sakit/
 *  cuti/dinas/alpha hari itu, atau yang dipilih petugas) → jam mengajarnya hari itu → calon pengganti = guru yang TIDAK
 *  mengajar sepanjang blok itu dan sendirinya tidak berhalangan. Urutan: mengajar mapel yang sama, mengajar di kelas itu,
 *  sedang ada di sekolah hari itu (punya jam lain), lalu yang jamnya paling sedikit. Satu pengganti tidak diberi dua blok
 *  yang bertabrakan. Ini USULAN untuk guru piket/Kurikulum — tidak ada yang ditetapkan otomatis. */
const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const tumpang = (a: { mulai: string; selesai: string }, b: { mulai: string; selesai: string }) => a.mulai < b.selesai && b.mulai < a.selesai;

export async function saranPengganti(tanggalIso: string, guruTambahan: string[] = []) {
  const tgl = new Date(`${tanggalIso}T00:00:00Z`), hari = HARI[tgl.getUTCDay()];
  const minggu = await getWeekTypeForDate(tgl).catch(() => "SEMUA");
  const [jadwal, absen, guru] = await Promise.all([
    prisma.schedule.findMany({ where: { day: hari, scheduleType: "BLOK", teacherId: { not: null } }, select: { teacherId: true, classId: true, subject: true, startTime: true, endTime: true, weekType: true, class: { select: { name: true } } } }),
    prisma.staffAttendance.findMany({ where: { tanggal: tgl, status: { in: ["IZIN", "SAKIT", "CUTI", "DINAS_LUAR", "ALPHA"] } }, select: { status: true, user: { select: { teacher: { select: { id: true } } } } } }),
    prisma.teacher.findMany({ select: { id: true, user: { select: { name: true } }, teachingLoad: { select: { classId: true, subject: { select: { name: true } } } } } }),
  ]);
  const hariItu = jadwal.filter(j => weekTypesOverlap(j.weekType, minggu));
  const berhalangan = new Map<string, string>();
  for (const a of absen) if (a.user.teacher) berhalangan.set(a.user.teacher.id, a.status);
  for (const id of guruTambahan) if (!berhalangan.has(id)) berhalangan.set(id, "DIPILIH");
  const nama = new Map(guru.map(g => [g.id, g.user.name]));
  // Blok = jam berurutan seorang guru di kelas & mapel yang sama.
  type Blok = { teacherId: string; guru: string; alasan: string; classId: string; kelas: string; mapel: string; mulai: string; selesai: string; jam: number };
  const blok: Blok[] = [];
  for (const [tid, alasan] of berhalangan) {
    const milik = hariItu.filter(j => j.teacherId === tid).sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const j of milik) {
      const t = blok[blok.length - 1];
      if (t && t.teacherId === tid && t.classId === j.classId && t.mapel === j.subject && t.selesai >= j.startTime) { if (j.endTime > t.selesai) t.selesai = j.endTime; t.jam++; }
      else blok.push({ teacherId: tid, guru: nama.get(tid) ?? "—", alasan, classId: j.classId, kelas: j.class.name, mapel: j.subject, mulai: j.startTime, selesai: j.endTime, jam: 1 });
    }
  }
  const sibuk = new Map<string, { mulai: string; selesai: string }[]>();
  for (const j of hariItu) sibuk.set(j.teacherId!, [...(sibuk.get(j.teacherId!) ?? []), { mulai: j.startTime, selesai: j.endTime }]);
  const dipakai = new Map<string, { mulai: string; selesai: string }[]>();
  const hasil = blok.sort((a, b) => a.mulai.localeCompare(b.mulai) || a.kelas.localeCompare(b.kelas)).map(b => {
    const calon = guru.filter(g => g.id !== b.teacherId && !berhalangan.has(g.id) && g.teachingLoad.length > 0 && !(sibuk.get(g.id) ?? []).some(s => tumpang(s, b))).map(g => {
      const mapelSama = g.teachingLoad.some(t => t.subject.name === b.mapel), kelasSama = g.teachingLoad.some(t => t.classId === b.classId), diSekolah = (sibuk.get(g.id) ?? []).length > 0;
      return {
        id: g.id, nama: g.user.name, skor: (mapelSama ? 3 : 0) + (kelasSama ? 2 : 0) + (diSekolah ? 1 : 0), jamHariItu: (sibuk.get(g.id) ?? []).length,
        alasan: [mapelSama && "mengajar mapel yang sama", kelasSama && "mengajar di kelas ini", diSekolah ? "ada jam lain hari ini" : "tidak ada jam hari ini"].filter(Boolean).join(", "),
      };
    }).sort((x, y) => y.skor - x.skor || x.jamHariItu - y.jamHariItu || x.nama.localeCompare(y.nama));
    // Usulan utama: calon terbaik yang belum diberi blok lain yang bertabrakan dengan blok ini.
    const utama = calon.find(c => !(dipakai.get(c.id) ?? []).some(s => tumpang(s, b))) ?? null;
    if (utama) dipakai.set(utama.id, [...(dipakai.get(utama.id) ?? []), { mulai: b.mulai, selesai: b.selesai }]);
    return { ...b, usulan: utama, lainnya: calon.filter(c => c.id !== utama?.id).slice(0, 3), calon: calon.length };
  });
  return {
    tanggal: tanggalIso, hari, minggu, blok: hasil,
    guru: guru.filter(g => g.teachingLoad.length > 0).map(g => ({ id: g.id, nama: g.user.name })).sort((a, b) => a.nama.localeCompare(b.nama)),
    berhalangan: [...berhalangan].map(([id, alasan]) => ({ id, nama: nama.get(id) ?? "—", alasan })),
  };
}
