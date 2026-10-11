import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Statistik pemakaian menu `hari` terakhir (7–90): per peran & jalur → jumlah dibuka + berapa akun (per bulan berjalan
 *  & bulan lalu yang tercakup). Hanya Superadmin. */
export async function GET(req: Request) {
  await verifyRole(["ADMIN"]);
  const hari = Math.min(90, Math.max(7, Number(new URL(req.url).searchParams.get("hari")) || 30));
  const wib = new Date(Date.now() + 7 * 3600_000);
  const sampai = new Date(`${wib.toISOString().slice(0, 10)}T00:00:00Z`), dari = new Date(sampai.getTime() - (hari - 1) * 86_400_000);
  const bulan = [...new Set([dari.toISOString().slice(0, 7), sampai.toISOString().slice(0, 7)])];
  const [buka, orang, pertama, akun, jabatan] = await Promise.all([
    prisma.pemakaianMenu.groupBy({ by: ["peran", "jalur"], where: { tanggal: { gte: dari, lte: sampai } }, _sum: { jumlah: true } }),
    prisma.pemakaianOrang.findMany({ where: { bulan: { in: bulan } }, select: { peran: true, jalur: true, userId: true } }),
    prisma.pemakaianMenu.findFirst({ orderBy: { tanggal: "asc" }, select: { tanggal: true } }),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.jabatan.findMany({ select: { name: true } }).catch(() => []),
  ]);
  const orangPer = new Map<string, Set<string>>(), aktif = new Map<string, Set<string>>();
  for (const o of orang) {
    const k = `${o.peran}|${o.jalur}`; orangPer.set(k, (orangPer.get(k) ?? new Set()).add(o.userId));
    aktif.set(o.peran, (aktif.get(o.peran) ?? new Set()).add(o.userId));
  }
  return Response.json({
    hari, sejak: pertama?.tanggal.toISOString().slice(0, 10) ?? null, jabatan: jabatan.map(j => j.name),
    peran: akun.map(a => ({ peran: a.role, akun: a._count._all, aktif: aktif.get(a.role)?.size ?? 0 })),
    baris: buka.map(b => ({ peran: b.peran, jalur: b.jalur, dibuka: b._sum.jumlah ?? 0, orang: orangPer.get(`${b.peran}|${b.jalur}`)?.size ?? 0 })),
  });
}
