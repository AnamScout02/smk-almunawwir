import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { id } = await params;
    const { nip, subject, phone } = await req.json();

    const teacher = await prisma.teacher.update({
      where: { id },
      data: { nip, subject, phone: phone || null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        homeroomOf: { select: { id: true, name: true } },
      },
    });
    return Response.json(teacher);
  } catch {
    return Response.json({ error: "Gagal mengupdate profil guru" }, { status: 500 });
  }
}
