import { verifyRole } from "@/lib/dal";
import { bolehPantauGuru } from "@/lib/pantau-guru";
import { logActivity } from "@/lib/activity-log";
import { rapikanButir, simpanButir, susunBuktiAkreditasi } from "@/lib/bukti-akreditasi";

export const dynamic = "force-dynamic";

/** Bukti akreditasi (src/lib/bukti-akreditasi.ts) — Admin, Kepala Sekolah, Wakil Kepala Kurikulum, dan Penjamin Mutu. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await bolehPantauGuru(session))) return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
  return Response.json(await susunBuktiAkreditasi());
}

export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await bolehPantauGuru(session))) return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { butir?: unknown };
  const butir = rapikanButir(b.butir);
  if (!butir.length) return Response.json({ error: "Daftar butir tidak boleh kosong." }, { status: 400 });
  await simpanButir(butir);
  await logActivity(session, { action: "UPDATE", entity: "BuktiAkreditasi", description: `Menyimpan ${butir.length} butir bukti akreditasi` }).catch(() => null);
  return Response.json({ ok: true, jumlah: butir.length });
}
