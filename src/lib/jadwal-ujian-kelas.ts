/** JAM UJIAN PER KELAS (21 September 2026). Permintaan user: pada kegiatan per kelas seperti STS, satu ujian
 * dipakai beberapa kelas di jam berbeda — "AIJ XI TKJ 1 jam 07.15–08.15, setelah itu jam berikutnya XI TKJ 2".
 * Soal cukup satu ujian; `Exam.jadwalKelas` menyimpan jendela waktu tiap kelas, dan `Exam.startTime/endTime`
 * menjadi AMPLOP-nya (paling awal – paling akhir) untuk daftar & status "sedang berlangsung".
 *
 * Aturan pakai: setiap tempat yang membuka/menutup ujian untuk SISWA atau menghitung batas waktunya WAJIB memakai
 * `jendelaKelas(exam, classIdSiswa)` — bukan `exam.startTime/endTime` langsung. Berkas ini netral (tanpa
 * server-only) supaya penyusun ujian di browser bisa memakai tipe & pembacanya. */

export type JadwalKelas = Record<string, { mulai: string; selesai: string }>;

/** Baca `Exam.jadwalKelas` (JSON) — isian rusak diabaikan, bukan galat. */
export function bacaJadwalKelas(v: unknown): JadwalKelas {
  const hasil: JadwalKelas = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return hasil;
  for (const [classId, isi] of Object.entries(v as Record<string, unknown>)) {
    if (!isi || typeof isi !== "object") continue;
    const { mulai, selesai } = isi as Record<string, unknown>;
    if (typeof mulai !== "string" || typeof selesai !== "string") continue;
    const a = new Date(mulai), b = new Date(selesai);
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || a >= b) continue;
    hasil[classId] = { mulai: a.toISOString(), selesai: b.toISOString() };
  }
  return hasil;
}

export function adaJadwalKelas(e: { jadwalKelas?: unknown }): boolean {
  return Object.keys(bacaJadwalKelas(e.jadwalKelas)).length > 0;
}

/** Jendela waktu ujian untuk SATU kelas. Kelas tanpa jam khusus memakai jam umum ujian. */
export function jendelaKelas(
  e: { startTime: Date; endTime: Date; jadwalKelas?: unknown },
  classId: string | null | undefined,
): { startTime: Date; endTime: Date } {
  const j = classId ? bacaJadwalKelas(e.jadwalKelas)[classId] : undefined;
  return j ? { startTime: new Date(j.mulai), endTime: new Date(j.selesai) } : { startTime: e.startTime, endTime: e.endTime };
}

/** Rapikan isian jam per kelas saat ujian disimpan: hanya kelas peserta, mulai < selesai. Mengembalikan jadwal
 * bersih + amplop waktunya. Kelas peserta yang tidak punya jam khusus tetap memakai jam umum, jadi jam umum ikut
 * masuk amplop hanya bila ada kelas seperti itu. */
export function rapikanJadwalKelas(
  masuk: unknown, kelasIds: string[], umum: { startTime: Date; endTime: Date },
): { jadwal: JadwalKelas; startTime: Date; endTime: Date; galat?: string } {
  const mentah = masuk && typeof masuk === "object" ? (masuk as Record<string, { mulai?: unknown; selesai?: unknown }>) : {};
  for (const [classId, isi] of Object.entries(mentah)) {
    if (!kelasIds.includes(classId) || !isi) continue;
    const a = new Date(String(isi.mulai ?? "")), b = new Date(String(isi.selesai ?? ""));
    if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return { jadwal: {}, ...umum, galat: "Jam per kelas belum lengkap." };
    if (a >= b) return { jadwal: {}, ...umum, galat: "Jam mulai tiap kelas harus sebelum jam selesainya." };
  }
  const jadwal = Object.fromEntries(Object.entries(bacaJadwalKelas(mentah)).filter(([id]) => kelasIds.includes(id)));
  const isi = Object.values(jadwal);
  if (!isi.length) return { jadwal, ...umum };
  const lengkap = kelasIds.every(id => jadwal[id]);
  const awal = [...isi.map(j => new Date(j.mulai).getTime()), ...(lengkap ? [] : [umum.startTime.getTime()])];
  const akhir = [...isi.map(j => new Date(j.selesai).getTime()), ...(lengkap ? [] : [umum.endTime.getTime()])];
  return { jadwal, startTime: new Date(Math.min(...awal)), endTime: new Date(Math.max(...akhir)) };
}
