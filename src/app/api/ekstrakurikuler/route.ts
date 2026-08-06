import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";
import { getJabatanNames } from "@/lib/jabatan-guard";

export const dynamic = "force-dynamic";

async function assertCanManageCategories(session: { role: string; email: string }) {
  if (session.role === "ADMIN" || session.role === "TAS") return;
  const names = await getJabatanNames(session.email);
  if (!names.includes("Koordinator Ekstrakurikuler")) throw new Error("FORBIDDEN");
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);

    if (session.role === "ADMIN" || session.role === "TAS") {
      const all = await prisma.extracurricular.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { members: true } } },
      });
      return NextResponse.json(all);
    }

    const owned = await getOwnedExtracurricularNames(session.email);
    if (owned.length === 0) return NextResponse.json({ error: "Khusus Pembina Ekstrakurikuler." }, { status: 403 });

    const list = await prisma.extracurricular.findMany({
      where: { name: { in: owned } },
      orderBy: { name: "asc" },
      include: { _count: { select: { members: true } } },
    });
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertCanManageCategories(session);

    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Nama ekstrakurikuler wajib diisi." }, { status: 400 });

    const exists = await prisma.extracurricular.findUnique({ where: { name: name.trim() } });
    if (exists) return NextResponse.json({ error: "Ekstrakurikuler dengan nama ini sudah ada." }, { status: 400 });

    const created = await prisma.extracurricular.create({ data: { name: name.trim() } });
    return NextResponse.json({ ...created, _count: { members: 0 } }, { status: 201 });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Koordinator Ekstrakurikuler." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menambah ekstrakurikuler." }, { status: 500 });
  }
}
