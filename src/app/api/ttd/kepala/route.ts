import { verifySession } from "@/lib/dal";
import { petugasTu } from "@/lib/tas-access-guard";
import { getSettings, getPrincipalName } from "@/lib/site-settings";
import { ttdDariNama } from "@/lib/ttd";

export const dynamic = "force-dynamic";

/** TTD PRIBADI Kepala Sekolah (nama dari Struktur Organisasi) untuk dokumen cetak TU yang dirakit di browser
 *  (Buku Induk Siswa, Buku Mutasi). Hanya Admin & petugas TU — SENGAJA tidak lewat /api/settings/school-info yang terbuka umum. */
export async function GET() {
  await verifySession();
  if (!(await petugasTu())) return Response.json({ ttd: null }, { status: 403 });
  const s = await getSettings(["school.structure"]);
  return Response.json({ ttd: (await ttdDariNama(getPrincipalName(s["school.structure"]))) ?? null },
    { headers: { "Cache-Control": "private, no-store" } });
}
