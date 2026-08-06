import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { searchParams } = new URL(req.url);
    const adminTeacherId = searchParams.get("teacherId");

    const select = {
      nip: true,
      user: { select: { name: true } },
      jabatan: { select: { jabatan: { select: { id: true, name: true } } } },
    } as const;

    const teacher = (session.role === "ADMIN" || session.role === "TAS") && adminTeacherId
      ? await prisma.teacher.findUnique({ where: { id: adminTeacherId }, select })
      : await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select });

    return Response.json({
      name: teacher?.user.name ?? session.name,
      nip: teacher?.nip ?? "",
      jabatan: teacher?.jabatan.map(j => j.jabatan.name) ?? [],
      jabatanDetailed: teacher?.jabatan.map(j => j.jabatan) ?? [],
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
