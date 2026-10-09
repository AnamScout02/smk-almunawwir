import { verifySession } from "@/lib/dal";
import { bolehPeta } from "@/lib/peta-guard";
import { batasDesa } from "@/lib/peta-desa";

/** Batas desa satu kabupaten untuk peta sebaran — hanya yang boleh membuka peta (bolehPeta), supaya
 *  orang luar tidak bisa memicu pengunduhan ratusan kabupaten. */
export async function GET(_req: Request, { params }: { params: Promise<{ kab: string }> }) {
  const session = await verifySession();
  if (!session || !(await bolehPeta(session))) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const { kab } = await params;
  try {
    const isi = await batasDesa(kab);
    return Response.json(isi, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    const m = e instanceof Error ? e.message : "";
    return Response.json({ error: m === "TIDAK_ADA" ? "Batas desa kabupaten ini belum tersedia di sumber data." : m === "KODE" ? "Kode tidak sah." : "Batas desa gagal diambil. Coba lagi nanti." },
      { status: m === "KODE" ? 400 : m === "TIDAK_ADA" ? 404 : 502 });
  }
}
