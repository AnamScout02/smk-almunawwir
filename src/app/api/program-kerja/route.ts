import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOwnedJabatanIds } from "@/lib/jabatan-guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { searchParams } = new URL(req.url);
  const jabatanId = searchParams.get("jabatanId");

  if (session.role === "ADMIN" || session.role === "TAS") {
    const programs = await prisma.programKerja.findMany({
      where: jabatanId ? { jabatanId } : undefined,
      include: { jabatan: { select: { id: true, name: true } } },
      orderBy: { tanggalMulai: "desc" },
    });
    return NextResponse.json(programs);
  }

  const owned = await getOwnedJabatanIds(session.email);
  const ownedIds = owned.map(j => j.id);
  const programs = await prisma.programKerja.findMany({
    where: {
      jabatanId: jabatanId && ownedIds.includes(jabatanId) ? jabatanId : { in: ownedIds },
    },
    include: { jabatan: { select: { id: true, name: true } } },
    orderBy: { tanggalMulai: "desc" },
  });
  return NextResponse.json(programs);
}

export async function POST(req: NextRequest) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const body = await req.json();
  const { jabatanId, title, description, tanggalMulai, tanggalSelesai, status } = body;

  if (!jabatanId || !title || !tanggalMulai) {
    return NextResponse.json({ error: "Jabatan, judul, dan tanggal mulai wajib diisi" }, { status: 400 });
  }

  if (session.role === "TEACHER") {
    const owned = await getOwnedJabatanIds(session.email);
    if (!owned.some(j => j.id === jabatanId)) {
      return NextResponse.json({ error: "Anda tidak memegang jabatan ini" }, { status: 403 });
    }
  }

  try {
    const program = await prisma.programKerja.create({
      data: {
        jabatanId,
        title,
        description: description || null,
        tanggalMulai: new Date(tanggalMulai),
        tanggalSelesai: tanggalSelesai ? new Date(tanggalSelesai) : null,
        status: status || "DIRENCANAKAN",
        createdByName: session.name,
      },
      include: { jabatan: { select: { id: true, name: true } } },
    });
    return NextResponse.json(program, { status: 201 });
  } catch (err) {
    console.error("[program-kerja POST]", err);
    return NextResponse.json({ error: "Gagal menyimpan program kerja" }, { status: 500 });
  }
}
