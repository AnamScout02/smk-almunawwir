import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";

export const dynamic = "force-dynamic";

/** MENU CEPAT PILIHAN PENGGUNA — daftar href yang ditampilkan di kisi "Menu Cepat" dashboard,
 * diatur sendiri tiap akun (18 September 2026, permintaan user: "bisa atur menu cepat isinya apa").
 * Kosong = memakai urutan bawaan portal. Isinya hanya alamat menu, jadi hak akses tetap dijaga
 * halaman tujuan masing-masing. */
export async function GET() {
  const session = await verifySession();
  const baris = await prisma.menuFavorit.findUnique({ where: { userId: session.userId }, select: { hrefs: true } }).catch(() => null);
  return Response.json({ hrefs: baris?.hrefs ?? null });
}

export async function PUT(req: Request) {
  const session = await verifySession();
  const b = await req.json().catch(() => ({}));
  const hrefs = Array.isArray(b.hrefs)
    ? [...new Set(b.hrefs.filter((h: unknown) => typeof h === "string" && h.startsWith("/") && h.length < 200))].slice(0, 16) as string[]
    : [];
  await prisma.menuFavorit.upsert({
    where: { userId: session.userId },
    create: { userId: session.userId, hrefs },
    update: { hrefs },
  });
  return Response.json({ ok: true, hrefs });
}
