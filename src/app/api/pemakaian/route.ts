import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const AWALAN = ["/dashboard/", "/pusat-", "/perpustakaan", "/ujian-online", "/kartu-identitas", "/bantuan"];
/** Alamat → jalur menu: tanpa query, id (cuid/angka/token panjang) diganti ":id", maks 5 ruas. */
function rapikan(jalur: string): string | null {
  const p = jalur.split("?")[0].split("#")[0];
  if (!p.startsWith("/") || p.length > 200 || !AWALAN.some(a => p.startsWith(a))) return null;
  return "/" + p.split("/").filter(Boolean).slice(0, 5).map(r => (/^\d+$/.test(r) || /^[A-Za-z0-9_-]{18,}$/.test(r) ? ":id" : r.toLowerCase())).join("/");
}

/** Pencatat pemakaian menu (dipanggil `PencatatPemakaian` saat halaman portal dibuka). Selalu 204 — gagal mencatat
 *  tidak boleh terasa oleh pengguna. Admin yang sedang "Masuk Sebagai" tidak dihitung. */
export async function POST(req: Request) {
  try {
    const s = await getSession().catch(() => null);
    if (!s?.userId || s.imp) return new Response(null, { status: 204 });
    const b = await req.json().catch(() => ({})) as { jalur?: unknown };
    const jalur = typeof b.jalur === "string" ? rapikan(b.jalur) : null;
    if (!jalur) return new Response(null, { status: 204 });
    const wib = new Date(Date.now() + 7 * 3600_000).toISOString();
    const tanggal = new Date(`${wib.slice(0, 10)}T00:00:00Z`), bulan = wib.slice(0, 7);
    await prisma.pemakaianMenu.upsert({ where: { tanggal_peran_jalur: { tanggal, peran: s.role, jalur } }, create: { tanggal, peran: s.role, jalur, jumlah: 1 }, update: { jumlah: { increment: 1 } } });
    await prisma.pemakaianOrang.upsert({ where: { bulan_jalur_userId: { bulan, jalur, userId: s.userId } }, create: { bulan, peran: s.role, jalur, userId: s.userId }, update: {} });
  } catch { /* diam */ }
  return new Response(null, { status: 204 });
}
