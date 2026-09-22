import "server-only";

export interface AttendanceLike {
  status: string;
  date: Date | string;
}

/** Persentase kehadiran (status "HADIR" / total record) — dipakai bareng dashboard Siswa, Rapor
 * Siswa, dan sekarang Portal Orang Tua (sebelumnya duplikat inline di 2 tempat). */
export function computeAttendancePct(records: AttendanceLike[]): number {
  if (records.length === 0) return 0;
  const present = records.filter(r => r.status === "HADIR").length;
  return Math.round((present / records.length) * 100);
}
