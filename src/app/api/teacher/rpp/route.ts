import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);

    const [plans, teacher, subjects] = await Promise.all([
      prisma.lessonPlan.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          teacher: { select: { id: true, user: { select: { name: true } } } },
          subject: { select: { name: true } },
        },
      }),
      prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { id: true } }),
      prisma.subject.findMany({ select: { id: true, name: true, grade: true }, orderBy: { name: "asc" } }),
    ]);

    return NextResponse.json({ plans, myTeacherId: teacher?.id ?? null, subjects });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);

    const body = await req.json();
    const { title, subjectId, grade, semester, objectives, material, activities, assessment, fileUrl } = body;
    if (!title?.trim()) {
      return NextResponse.json({ error: "Judul RPP wajib diisi" }, { status: 400 });
    }

    let teacherId: string | null = null;
    if (session.role === "TEACHER") {
      const teacher = await prisma.teacher.findFirst({ where: { user: { email: session.email } } });
      teacherId = teacher?.id ?? null;
    } else {
      if (!subjectId) {
        return NextResponse.json({ error: "Pilih mata pelajaran dulu agar RPP tercatat atas nama guru pengampunya." }, { status: 400 });
      }
      const assignment = await prisma.teachingAssignment.findFirst({ where: { subjectId }, select: { teacherId: true } });
      teacherId = assignment?.teacherId ?? null;
    }
    if (!teacherId) return NextResponse.json({ error: "Tidak ditemukan guru pengampu mata pelajaran ini." }, { status: 400 });

    const plan = await prisma.lessonPlan.create({
      data: {
        teacherId, title,
        subjectId: subjectId || null, grade: grade ? Number(grade) : null, semester: semester || null,
        objectives: objectives || null, material: material || null, activities: activities || null,
        assessment: assessment || null, fileUrl: fileUrl || null,
      },
      include: { teacher: { select: { id: true, user: { select: { name: true } } } }, subject: { select: { name: true } } },
    });
    return NextResponse.json(plan, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    console.error("[teacher rpp POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan RPP" }, { status: 500 });
  }
}
