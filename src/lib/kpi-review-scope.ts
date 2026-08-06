import "server-only";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { getKpiJabatanNamesSupervisedBy } from "@/lib/kpi-engine";

const LEADERSHIP_JABATAN = [
  "Kepala Sekolah", "Wakil Kepala Kurikulum", "Wakil Kepala Kesiswaan",
  "Wakil Kepala Humas", "Wakil Kepala Sarana Prasarana", "Wakil Kepala Bidang Penjamin Mutu",
];

/** Tentukan cakupan review KpiSubmission seorang pimpinan.
 * `null` = boleh lihat/approve SEMUA jabatan (ADMIN atau Kepala Sekolah — pengawasan penuh).
 * `string[]` = HANYA jabatanName KPI yang ada di daftar ini (Wakasek per bidang, lihat
 * `KPI_SUPERVISOR_MAP` di kpi-engine.ts). Throw "FORBIDDEN" kalau bukan pimpinan sama sekali.
 * Kalau seseorang kebetulan pegang >1 jabatan Wakasek, cakupannya digabung (union), bukan salah satu
 * yang dipilih sepihak. */
export async function getKpiReviewScope(session: { role: string; email: string }): Promise<string[] | null> {
  if (session.role === "ADMIN") return null;
  const names = await getJabatanNames(session.email);
  const matched = names.filter(n => LEADERSHIP_JABATAN.includes(n));
  if (matched.length === 0) throw new Error("FORBIDDEN");
  if (matched.includes("Kepala Sekolah")) return null;

  const scope = new Set<string>();
  for (const m of matched) {
    for (const jn of getKpiJabatanNamesSupervisedBy(m)) scope.add(jn);
  }
  return [...scope];
}
