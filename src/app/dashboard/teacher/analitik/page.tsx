export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import { KESISWAAN_BK_JABATAN } from "@/lib/kesiswaan-guard";
import AnalitikData from "@/components/jabatan/AnalitikData";

export const metadata = { title: "Analitik Data" };

/** Pimpinan (Kepala Sekolah, Kurikulum, Penjamin Mutu) melihat semuanya; Wakil Kepala Kesiswaan & Guru BK hanya bagian
 *  siswa (pola ketidakhadiran siswa & proyeksi) — kejanggalan nilai dan pola guru bukan wewenangnya. */
export default async function Page({ searchParams }: { searchParams: Promise<{ bagian?: string }> }) {
  const session = await verifyRole(["TEACHER", "TAS"]);
  const pimpinan = await bolehPantauGuru(session);
  const bk = (await getJabatanNames(session.email).catch(() => [] as string[])).some(j => KESISWAAN_BK_JABATAN.includes(j));
  if (!pimpinan && !bk) redirect("/dashboard/teacher");
  return <AnalitikData bagian={(await searchParams).bagian} dasar="/dashboard/teacher/analitik" bolehGuru={pimpinan} bolehAtur={pimpinan} />;
}
