import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const major = await prisma.major.findUnique({
      where: { id },
      include: { gallery: { orderBy: { order: "asc" } } },
    });
    if (!major) return Response.json({ error: "Jurusan tidak ditemukan." }, { status: 404 });
    return Response.json(major);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const { name, code, description, icon, logoUrl, nisCode, tagline, longDesc, skills, career, cert, features, themeColor } = await req.json();
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
        logoUrl: logoUrl?.trim() || null,
        ...(nisCode !== undefined && { nisCode: nisCode?.trim() || null }),
        ...(tagline !== undefined && { tagline: tagline?.trim() || null }),
        ...(longDesc !== undefined && { longDesc: longDesc?.trim() || null }),
        ...(skills !== undefined && { skills: (skills as string[]).filter(s => s.trim()) }),
        ...(career !== undefined && { career: (career as string[]).filter(s => s.trim()) }),
        ...(cert !== undefined && { cert: cert?.trim() || null }),
        ...(features !== undefined && { features: (features as string[]).filter(s => s.trim()) }),
        ...(themeColor !== undefined && { themeColor: /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : null }),
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
    await verifyTasAccess();
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
