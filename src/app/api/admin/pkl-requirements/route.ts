import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { assertHumas } from "@/lib/humas-guard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const items = await prisma.pklDocumentRequirement.findMany({ orderBy: { order: "asc" } });
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertHumas(session);
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nama dokumen wajib diisi." }, { status: 400 });

    const count = await prisma.pklDocumentRequirement.count();
    const item = await prisma.pklDocumentRequirement.create({
      data: { name: name.trim(), order: count },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Wakil Kepala Humas." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menambah dokumen syarat." }, { status: 500 });
  }
}
