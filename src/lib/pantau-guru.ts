import "server-only";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { JABATAN_PANTAU_GURU } from "@/lib/pantau-guru-akses";

/** true = boleh melihat SEMUA guru (Admin + Kepala Sekolah, Wakil Kepala Kurikulum, Penjamin Mutu). Varian tanpa lemparan. */
export async function bolehPantauGuru(session: { role: string; email: string }): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  if (session.role !== "TEACHER" && session.role !== "TAS") return false;
  const j = await getJabatanNames(session.email).catch(() => [] as string[]);
  return JABATAN_PANTAU_GURU.some(n => j.includes(n));
}
export async function assertPantauGuru(session: { role: string; email: string }) {
  if (!(await bolehPantauGuru(session))) throw new Error("FORBIDDEN");
}
