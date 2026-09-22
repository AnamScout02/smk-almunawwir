import "server-only";
import { join } from "path";

/** JAWABAN LISAN (22 September 2026) — rekaman suara siswa = data pribadi, jadi disimpan di folder RAHASIA
 * (`public/uploads/rahasia/…`, diblokir proxy — CLAUDE.md #44/#50) dan hanya diputar lewat
 * GET /api/ujian/lisan/<examId>/<berkas> (pemilik rekaman atau guru yang berhak atas ujian itu).
 * Nama berkas = `<attemptId>-<questionId>-<waktu>.<ext>` — rute jawab MENOLAK alamat rekaman milik pengerjaan lain,
 * supaya siswa tidak bisa "meminjam" rekaman teman sebagai jawabannya. */

export const FOLDER_LISAN = join(process.cwd(), "public", "uploads", "rahasia", "ujian-lisan");
export const MAKS_BYTE_LISAN = 12 * 1024 * 1024;

const EKSTENSI: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/aac": "aac", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/x-m4a": "m4a" };
export const JENIS_MIME: Record<string, string> = { webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", mp3: "audio/mpeg", wav: "audio/wav" };

export function ekstensiAudio(mime: string): string | null {
  return EKSTENSI[(mime || "").split(";")[0].trim().toLowerCase()] ?? null;
}

const POLA_BERKAS = /^([a-z0-9]+)-([a-z0-9]+)-(\d+)\.(webm|ogg|m4a|aac|mp3|wav)$/;
export function uraiBerkasLisan(berkas: string): { attemptId: string; questionId: string; ext: string } | null {
  const m = POLA_BERKAS.exec(berkas);
  return m ? { attemptId: m[1], questionId: m[2], ext: m[4] } : null;
}

export const alamatLisan = (examId: string, berkas: string) => `/api/ujian/lisan/${examId}/${berkas}`;

/** Jawaban teks yang TAMPAK seperti alamat rekaman harus milik pengerjaan ini (rute jawab). */
export function rekamanMilikSendiri(jawaban: unknown, examId: string, attemptId: string): boolean {
  if (typeof jawaban !== "string" || !jawaban.startsWith("/api/ujian/lisan/")) return true;
  return jawaban.startsWith(`/api/ujian/lisan/${examId}/${attemptId}-`) && !!uraiBerkasLisan(jawaban.split("/").pop() ?? "");
}
