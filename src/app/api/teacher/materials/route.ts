import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

async function getTeacher(email: string) {
  return prisma.teacher.findFirst({ where: { user: { email } }, select: { id: true } });
}

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json([]);

    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const subject = searchParams.get("subject");

    const materials = await prisma.material.findMany({
      where: {
        teacherId: teacher.id,
        ...(classId ? { classId } : {}),
        ...(subject ? { subject } : {}),
      },
      include: { class: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });

    return Response.json(materials);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    const teacher = await getTeacher(session.email);
    if (!teacher) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { classId, subject, title, description, fileUrl, linkUrl } = await req.json();
    if (!classId || !subject?.trim() || !title?.trim()) {
      return Response.json({ error: "Kelas, mata pelajaran, dan judul wajib diisi." }, { status: 400 });
    }

    const hasAccess = await prisma.teachingAssignment.findFirst({
      where: { teacherId: teacher.id, classId, subject: { name: subject } },
    });
    if (!hasAccess) {
      return Response.json({ error: "Anda tidak mengajar mapel ini di kelas tersebut." }, { status: 403 });
    }

    const material = await prisma.material.create({
      data: {
        teacherId: teacher.id, classId, subject: subject.trim(), title: title.trim(),
        description: description?.trim() || null, fileUrl: fileUrl || null, linkUrl: linkUrl || null,
      },
    });

    return Response.json(material);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan materi." }, { status: 500 });
  }
}
