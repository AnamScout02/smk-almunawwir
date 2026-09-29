import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertExtracurricularAccess, getExtracurricularById } from "@/lib/ekstrakurikuler-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { id } = await params;
    const ekskul = await getExtracurricularById(id);
    if (!ekskul) return NextResponse.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    const members = await prisma.extracurricularMember.findMany({
      where: { extracurricularId: id },
      include: { student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
      orderBy: { joinedAt: "asc" },
    });
    return NextResponse.json(members);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Anda bukan pembina ekstrakurikuler ini." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    const { id } = await params;
    const ekskul = await getExtracurricularById(id);
    if (!ekskul) return NextResponse.json({ error: "Ekstrakurikuler tidak ditemukan" }, { status: 404 });
    await assertExtracurricularAccess(session, ekskul.name);

    const body = await req.json();
    const { studentId, role } = body;
    if (!studentId) return NextResponse.json({ error: "Siswa wajib dipilih" }, { status: 400 });

    const existing = await prisma.extracurricularMember.findUnique({
      where: { extracurricularId_studentId: { extracurricularId: id, studentId } },
    });
    if (existing) return NextResponse.json({ error: "Siswa ini sudah terdaftar" }, { status: 409 });

    const member = await prisma.extracurricularMember.create({
      data: { extracurricularId: id, studentId, role: role || null },
      include: { student: { select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
    });
    return NextResponse.json(member, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Anda bukan pembina ekstrakurikuler ini." }, { status: 403 });
    }
    console.error("[ekskul members POST]", e);
    return NextResponse.json({ error: "Gagal menambah anggota" }, { status: 500 });
  }
}
