import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const { name } = await req.json();
    if (!name?.trim()) {
      return Response.json({ error: "Nama jabatan wajib diisi." }, { status: 400 });
    }
    const jabatan = await prisma.jabatan.update({ where: { id }, data: { name: name.trim() } });
    return Response.json(jabatan);
  } catch {
    return Response.json({ error: "Gagal menyimpan. Nama jabatan mungkin sudah ada." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    await prisma.jabatan.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus jabatan." }, { status: 500 });
  }
}
