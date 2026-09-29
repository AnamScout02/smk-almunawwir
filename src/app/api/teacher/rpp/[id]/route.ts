import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

async function assertOwner(id: string, email: string, isAdmin: boolean) {
  if (isAdmin) return;
  const plan = await prisma.lessonPlan.findUnique({ where: { id }, select: { teacher: { select: { user: { select: { email: true } } } } } });
  if (!plan || plan.teacher.user.email !== email) throw new Error("FORBIDDEN");
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { id } = await params;
    await assertOwner(id, session.email, session.role === "ADMIN");

    const body = await req.json();
    const { title, subjectId, grade, semester, objectives, material, activities, assessment, fileUrl } = body;
    if (!title?.trim()) {
      return NextResponse.json({ error: "Judul RPP wajib diisi" }, { status: 400 });
    }

    const plan = await prisma.lessonPlan.update({
      where: { id },
      data: {
        title, subjectId: subjectId || null, grade: grade ? Number(grade) : null, semester: semester || null,
        objectives: objectives || null, material: material || null, activities: activities || null,
        assessment: assessment || null, fileUrl: fileUrl || null,
      },
      include: { teacher: { select: { id: true, user: { select: { name: true } } } }, subject: { select: { name: true } } },
    });
    return NextResponse.json(plan);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Hanya bisa ubah RPP milik sendiri" }, { status: 403 });
    }
    console.error("[teacher rpp PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan perubahan" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const { id } = await params;
    await assertOwner(id, session.email, session.role === "ADMIN");

    await prisma.lessonPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Hanya bisa hapus RPP milik sendiri" }, { status: 403 });
    }
    console.error("[teacher rpp DELETE]", e);
    return NextResponse.json({ error: "Gagal menghapus RPP" }, { status: 500 });
  }
}
