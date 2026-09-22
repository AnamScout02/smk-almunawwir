import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

export const JABATAN_PENGELOLA_OSIS = ["Pembina OSIS", "Wakil Kepala Kesiswaan"];

/** Pengelola pemilihan OSIS: Admin, Pembina OSIS, Wakasek Kesiswaan. */
export async function assertPengelolaOsis(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, JABATAN_PENGELOLA_OSIS);
}

/** Status efektif: BUKA hanya di dalam rentang waktu. */
export function statusEfektif(p: { status: string; mulai: Date; selesai: Date }, now = new Date()) {
  if (p.status !== "BUKA") return p.status;
  if (now < p.mulai) return "BELUM_MULAI";
  if (now >= p.selesai) return "TUTUP";
  return "BUKA";
}
