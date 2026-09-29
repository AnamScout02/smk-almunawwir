import { NextRequest } from "next/server";
import { verifyRole } from "@/lib/dal";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { EKSPOR } from "@/lib/ekspor-daftar";
import { balasanExcel } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

/** Satu pintu unduhan Excel untuk register yang belum punya endpoint sendiri — definisi & PENJAGA
 *  per daftar ada di src/lib/ekspor-daftar.ts. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ kunci: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { kunci } = await params;
    const def = EKSPOR[kunci];
    if (!def) return Response.json({ error: "Daftar tidak dikenal." }, { status: 404 });
    if (!(await def.boleh(session))) {
      return Response.json({ error: "Anda tidak berhak mengunduh daftar ini." }, { status: 403 });
    }
    const { headers, rows } = await def.susun();
    const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return balasanExcel({
      namaFile: `${kunci}-${hariIni}`,
      namaSheet: def.judul,
      headers,
      rows,
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[ekspor daftar]", e);
    return Response.json({ error: "Gagal menyusun berkas Excel." }, { status: 500 });
  }
}
