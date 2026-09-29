import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { NextRequest } from "next/server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const photos = await prisma.majorGallery.findMany({
      where: { majorId: id },
      orderBy: { order: "asc" },
    });
    return Response.json(photos);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyTasAccess();
    const { id } = await params;
    const { imageUrl, caption } = await req.json();
    if (!imageUrl?.trim()) {
      return Response.json({ error: "Foto wajib diisi." }, { status: 400 });
    }
    const count = await prisma.majorGallery.count({ where: { majorId: id } });
    const photo = await prisma.majorGallery.create({
      data: {
        majorId: id,
        imageUrl: imageUrl.trim(),
        caption: caption?.trim() || null,
        order: count,
      },
    });
    return Response.json(photo, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menambah foto." }, { status: 500 });
  }
}
