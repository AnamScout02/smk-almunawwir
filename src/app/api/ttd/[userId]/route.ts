import { verifySession } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { petugasTu } from "@/lib/tas-access-guard";
import { bacaBerkasTtd } from "@/lib/ttd";

export const dynamic = "force-dynamic";

/** Gambar TTD satu akun — HANYA pemiliknya atau petugas TU/Admin (pratinjau di Profil & halaman Tanda Tangan
 *  Pegawai). Dokumen cetak tidak memakai rute ini: TTD disisipkan server sebagai data URL (src/lib/ttd.ts). */
export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const s = await verifySession();
  const { userId } = await params;
  if (s.userId !== userId && !(await petugasTu())) return new Response("Not found", { status: 404 });
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { ttdBerkas: true } });
  const isi = u?.ttdBerkas ? await bacaBerkasTtd(u.ttdBerkas) : null;
  if (!isi) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(isi), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
