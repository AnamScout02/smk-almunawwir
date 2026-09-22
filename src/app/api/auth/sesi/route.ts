import { getSession } from "@/lib/session";
import { sesiMasihHidup } from "@/lib/sesi-server";

export const dynamic = "force-dynamic";

/** Identitas sesi aktif browser ini — dipakai PenjagaSesiTab untuk mendeteksi akun yang berganti
 * di tab lain. SENGAJA tidak redirect ke login (bukan verifySession): tab yang bertanya harus tahu
 * "sudah tidak ada sesi", bukan menerima HTML halaman login. */
export async function GET() {
  const s = await getSession();
  // DB sesaat bermasalah → anggap masih hidup, supaya tidak memunculkan peringatan palsu.
  const hidup = s?.sid ? await sesiMasihHidup(s.sid).catch(() => true) : false;
  return Response.json(
    hidup && s ? { userId: s.userId, nama: s.name, admin: s.imp?.name ?? null } : { userId: null, nama: null, admin: null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
