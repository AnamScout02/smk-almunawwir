import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Daftar semua akun Orang Tua (dibuat otomatis — lihat src/lib/parent-account.ts) beserta anak
 * yang terhubung. Read-only listing untuk TU/Admin, dipakai /dashboard/admin/parents. */
export async function GET() {
  await verifyRole(["ADMIN"]);
  const parents = await prisma.parent.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      children: {
        select: {
          id: true,
          student: {
            select: {
              id: true, nis: true,
              user: { select: { name: true } },
              class: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return Response.json(parents);
}
