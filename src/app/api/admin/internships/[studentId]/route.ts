import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { studentId } = await params;
    const { company, position, supervisor, startDate, endDate, status } = await req.json();

    if (!company?.trim() || !position?.trim() || !startDate || !endDate) {
      return Response.json({ error: "Perusahaan, posisi, dan tanggal wajib diisi." }, { status: 400 });
    }

    const internship = await prisma.internship.upsert({
      where: { studentId },
      create: {
        studentId,
        company: company.trim(),
        position: position.trim(),
        supervisor: supervisor?.trim() || "—",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || "ONGOING",
      },
      update: {
        company: company.trim(),
        position: position.trim(),
        supervisor: supervisor?.trim() || "—",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        status: status || "ONGOING",
      },
    });

    return Response.json(internship);
  } catch {
    return Response.json({ error: "Gagal menyimpan data PKL." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { studentId } = await params;
    await prisma.internship.delete({ where: { studentId } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus data PKL." }, { status: 500 });
  }
}
