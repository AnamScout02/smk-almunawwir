export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertPantauGuru } from "@/lib/pantau-guru";
import RekapBulananKepsek from "@/components/jabatan/RekapBulananKepsek";

export const metadata = { title: "Rekap Bulanan" };

/** Kepala Sekolah, Wakil Kepala Kurikulum, dan Penjamin Mutu (`JABATAN_PANTAU_GURU`). */
export default async function Page({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await verifyRole(["TEACHER", "TAS"]);
  await jabatanAtauAlihkan(session, () => assertPantauGuru(session));
  return <RekapBulananKepsek bulan={(await searchParams).bulan} dasar="/dashboard/teacher/rekap-bulanan" />;
}
