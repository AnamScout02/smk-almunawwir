import "server-only";
import { assertJabatan } from "@/lib/jabatan-guard";

/** Pola sama seperti jaringan-guard.ts/uks-guard.ts — ADMIN & TAS (staf TU murni) selalu lolos,
 * guru/TAS-via-jabatan cuma lolos kalau benar-benar Wakil Kepala Humas. Dipakai di semua fitur
 * domain Humas: Pendaftaran PKL, Mitra Industri (DU/DI), Tracer Study. */
export async function assertHumas(session: { role: string; email: string }) {
  if (session.role === "TEACHER" || session.role === "TAS") await assertJabatan(session, ["Wakil Kepala Humas"]);
}
