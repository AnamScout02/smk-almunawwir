import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const { nip, subject, phone, shortCode } = await req.json();

    const teacher = await prisma.teacher.update({
      where: { id },
      data: { nip, subject, phone: phone || null, shortCode: shortCode ? shortCode.toUpperCase() : null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        homeroomOf: { select: { id: true, name: true } },
      },
    });
    return Response.json(teacher);
  } catch (e) {
    const isDup = typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
    return Response.json({ error: isDup ? "Kode guru sudah dipakai guru lain" : "Gagal mengupdate profil guru" }, { status: isDup ? 400 : 500 });
  }
}
