import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { saranPengganti } from "@/lib/guru-pengganti";

export const dynamic = "force-dynamic";

/** Saran guru pengganti untuk satu tanggal — Wakil Kepala Kurikulum atau petugas Buku Piket. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const boleh = await assertKurikulum(session).then(() => true).catch(() => false) || await assertKedisiplinan(session).then(() => true).catch(() => false);
    if (!boleh) return Response.json({ error: "Khusus Kurikulum dan petugas piket." }, { status: 403 });
    const sp = new URL(req.url).searchParams;
    const tanggal = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("tanggal") ?? "") ? sp.get("tanggal")! : new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return Response.json(await saranPengganti(tanggal, (sp.get("guru") ?? "").split(",").filter(Boolean).slice(0, 20)));
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyusun saran." }, { status: 500 });
  }
}
