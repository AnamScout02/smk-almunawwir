import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { resolveTeacherId } from "@/lib/teacher-context";
import { teacherIdDariSesi } from "@/lib/ujian-server";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Wacana/stimulus bersama (grouping). */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const teacherId = await teacherIdDariSesi(session);
    if (session.role === "TEACHER" && !teacherId) return Response.json([]);
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const rows = await prisma.examStimulus.findMany({
      where: { ...(teacherId ? { teacherId } : {}), ...(q ? { judul: { contains: q, mode: "insensitive" } } : {}) },
      orderBy: { updatedAt: "desc" }, take: 200,
      include: { _count: { select: { bank: true, soal: true } } },
    });
    return Response.json(rows);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { judul, konten, subject } = await req.json();
    if (!judul?.trim() || !konten?.trim()) return Response.json({ error: "Judul dan isi wacana wajib diisi." }, { status: 400 });
    const teacherId = await resolveTeacherId(session, { subject: String(subject ?? "") });
    if (!teacherId) return Response.json({ error: "Tidak ditemukan guru pengampu." }, { status: 400 });
    const row = await prisma.examStimulus.create({ data: { teacherId, judul: judul.trim(), konten } });
    return Response.json(row, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan wacana." }, { status: 500 });
  }
}
