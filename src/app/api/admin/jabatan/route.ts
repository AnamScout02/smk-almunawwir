import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";

export async function GET() {
  try {
    await verifyTasAccess();
    const jabatan = await prisma.jabatan.findMany({
      include: { _count: { select: { teachers: true } } },
      orderBy: { name: "asc" },
    });
    return Response.json(jabatan);
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await verifyTasAccess();
    const { name } = await req.json();
    if (!name?.trim()) {
      return Response.json({ error: "Nama jabatan wajib diisi." }, { status: 400 });
    }
    const jabatan = await prisma.jabatan.create({ data: { name: name.trim() } });
    return Response.json(jabatan);
  } catch {
    return Response.json({ error: "Gagal menyimpan. Nama jabatan mungkin sudah ada." }, { status: 500 });
  }
}
