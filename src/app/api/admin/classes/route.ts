import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";

export async function GET() {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const classes = await prisma.class.findMany({
      include: {
        major: true,
        homeroom: { include: { user: { select: { name: true } } } },
        students: { select: { id: true } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });
    return Response.json(classes);
  } catch {
    return Response.json({ error: "Gagal memuat kelas" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const body = await req.json();
    const cls = await prisma.class.create({
      data: {
        name: body.name,
        grade: Number(body.grade),
        majorId: body.majorId,
        homeroomId: body.homeroomId || null,
      },
      include: {
        major: true,
        homeroom: { include: { user: { select: { name: true } } } },
        students: { select: { id: true } },
      },
    });
    return Response.json(cls, { status: 201 });
  } catch {
    return Response.json({ error: "Gagal membuat kelas" }, { status: 500 });
  }
}
