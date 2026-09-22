import { verifyTasAccess } from "@/lib/tas-access-guard";
import { getKlapperRows } from "@/lib/buku-klapper";

export const dynamic = "force-dynamic";

/** Buku Klapper — indeks alfabetis seluruh siswa lintas angkatan. Logika & sumber data ada di
 * src/lib/buku-klapper.ts (dipakai bareng halaman cetak, jangan digandakan di sini). */
export async function GET() {
  try {
    await verifyTasAccess();
    return Response.json(await getKlapperRows());
  } catch {
    return Response.json({ error: "Gagal memuat data" }, { status: 500 });
  }
}
