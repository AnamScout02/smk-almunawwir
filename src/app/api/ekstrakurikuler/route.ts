import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { TAS_JABATAN } from "@/lib/tas-access-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

// PERBAIKAN KRITIS 2026-08-10 (temuan user): dulu SIAPAPUN role TAS (termasuk Security/Kebersihan)
// otomatis lolos di sini tanpa cek jabatan — bisa lihat SEMUA ekskul & bikin ekskul baru. Sekarang
// TAS wajib jabatan TU eksplisit ATAU Koordinator Ekstrakurikuler, sama seperti ADMIN.
async function isFullAccess(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return true;
  if (session.role !== "TAS") return false;
  const names = await getJabatanNames(session.email);
  return names.some(n => TAS_JABATAN.includes(n));
}

async function assertCanManageCategories(session: { role: string; email: string }) {
  if (await isFullAccess(session)) return;
  const names = await getJabatanNames(session.email);
  if (!names.includes("Koordinator Ekstrakurikuler")) throw new Error("FORBIDDEN");
}

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);

    if (await isFullAccess(session)) {
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
  } catch (e) {
    lemparBilaPengalihan(e);
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
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Admin/TAS atau Koordinator Ekstrakurikuler." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menambah ekstrakurikuler." }, { status: 500 });
  }
}
