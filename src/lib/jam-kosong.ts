import "server-only";
import { prisma } from "@/lib/prisma";
import type { IsiNotifikasi } from "@/lib/push-server";

/** JAM KOSONG LANGSUNG KE KELAS (11 Okt 2026). Sumbernya catatan guru piket (`TeacherScheduleAttendance`): guru tidak
 *  hadir (IZIN/SAKIT/ALPHA) pada jam itu, dengan atau tanpa tugas titipan. Yang sampai ke siswa HANYA "guru berhalangan"
 *  dan isi tugasnya — alasan ketidakhadiran guru dan catatan petugas piket tidak pernah ikut. */
export interface JamKosong { mapel: string; mulai: string; selesai: string; guru: string; tugas: string | null }

export async function jamKosongKelas(classId: string, tanggalIso: string): Promise<JamKosong[]> {
  const awal = new Date(`${tanggalIso}T00:00:00Z`), akhir = new Date(awal.getTime() + 86_400_000);
  const baris = await prisma.teacherScheduleAttendance.findMany({
    where: { date: { gte: awal, lt: akhir }, status: { in: ["IZIN", "SAKIT", "ALPHA"] }, schedule: { classId } },
    select: { tugasTitipan: true, hasTugas: true, schedule: { select: { subject: true, startTime: true, endTime: true, teacher: { select: { user: { select: { name: true } } } } } } },
  }).catch(() => []);
  const urut = baris.map(b => ({ mapel: b.schedule.subject, mulai: b.schedule.startTime, selesai: b.schedule.endTime, guru: b.schedule.teacher?.user.name ?? "", tugas: b.hasTugas ? b.tugasTitipan?.trim() || null : null }))
    .sort((a, b) => a.mulai.localeCompare(b.mulai));
  // Jam berurutan untuk mapel & guru yang sama dijadikan satu baris.
  const hasil: JamKosong[] = [];
  for (const j of urut) {
    const t = hasil[hasil.length - 1];
    if (t && t.mapel === j.mapel && t.guru === j.guru && t.selesai >= j.mulai) { if (j.selesai > t.selesai) t.selesai = j.selesai; t.tugas = t.tugas ?? j.tugas; }
    else hasil.push({ ...j });
  }
  return hasil;
}

/** Kabar ke siswa kelas itu saat petugas piket menitipkan TUGAS untuk jam kosong HARI INI. Satu kabar per blok jam per
 *  hari (kunci dari jadwal pertama blok + tanggal) — menyimpan ulang tidak mengirim lagi. `kirim` disuntikkan. */
export async function kabariJamKosong(records: { scheduleIds: string[]; status: string; hasTugas?: boolean | null; tugasTitipan?: string }[], tanggalIso: string, kirim: (n: IsiNotifikasi) => Promise<unknown>) {
  if (tanggalIso !== new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)) return;
  for (const r of records) {
    const tugas = (r.tugasTitipan ?? "").trim();
    if (!tugas || r.hasTugas !== true || !["IZIN", "SAKIT", "ALPHA"].includes(r.status) || !r.scheduleIds.length) continue;
    const j = await prisma.schedule.findUnique({ where: { id: r.scheduleIds[0] }, select: { subject: true, startTime: true, classId: true } });
    if (!j) continue;
    const siswa = await prisma.student.findMany({ where: { classId: j.classId, studentStatus: "AKTIF" }, select: { userId: true } });
    await kirim({
      userIds: siswa.map(s => s.userId), jenis: "TUGAS_BARU", kunci: `jam-kosong:${r.scheduleIds[0]}:${tanggalIso}`,
      judul: `Tugas jam kosong: ${j.subject}`, isi: `Guru berhalangan hadir pada jam ${j.startTime}. Tugas: ${tugas.slice(0, 300)}`, url: "/dashboard/student",
    }).catch(() => null);
  }
}
