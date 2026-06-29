import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    const { name, code, description, icon } = await req.json();
    if (!name?.trim() || !code?.trim() || !description?.trim()) {
      return Response.json({ error: "Nama, kode, dan deskripsi wajib diisi." }, { status: 400 });
    }
    const major = await prisma.major.update({
      where: { id },
      data: {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        description: description.trim(),
        icon: icon?.trim() || null,
      },
    });
    return Response.json(major);
  } catch (e: unknown) {
    if ((e as { code?: string }).code === "P2002") {
      return Response.json({ error: "Kode jurusan sudah digunakan." }, { status: 409 });
    }
    return Response.json({ error: "Gagal mengupdate jurusan." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyRole(["ADMIN"]);
    const { id } = await params;
    const major = await prisma.major.findUnique({
      where: { id },
      include: { _count: { select: { students: true, classes: true } } },
    });
    if (!major) return Response.json({ error: "Jurusan tidak ditemukan." }, { status: 404 });
    if (major._count.students > 0 || major._count.classes > 0) {
      return Response.json(
        { error: `Tidak bisa dihapus — masih ada ${major._count.students} siswa dan ${major._count.classes} kelas di jurusan ini.` },
        { status: 409 }
      );
    }
    await prisma.major.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus jurusan." }, { status: 500 });
  }
}
