import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const teacherId = await teacherIdDariSesi(session);
    const ada = await prisma.examStimulus.findFirst({ where: { id, ...(teacherId ? { teacherId } : {}) } });
    if (!ada) return Response.json({ error: "Wacana tidak ditemukan" }, { status: 404 });
    const { judul, konten } = await req.json();
    const row = await prisma.examStimulus.update({ where: { id }, data: { judul: String(judul ?? ada.judul), konten: String(konten ?? ada.konten) } });
    return Response.json(row);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal memperbarui wacana." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const teacherId = await teacherIdDariSesi(session);
    const ada = await prisma.examStimulus.findFirst({ where: { id, ...(teacherId ? { teacherId } : {}) } });
    if (!ada) return Response.json({ error: "Wacana tidak ditemukan" }, { status: 404 });
    await prisma.examStimulus.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menghapus wacana." }, { status: 500 });
  }
}
