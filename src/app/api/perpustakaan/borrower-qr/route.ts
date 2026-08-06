import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { generateQrDataUrl } from "@/lib/qrcode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "SISWA";
    const classId = searchParams.get("classId");

    let people: { identifier: string; name: string; className: string | null }[] = [];

    if (type === "SISWA") {
      const students = await prisma.student.findMany({
        where: { studentStatus: "AKTIF", ...(classId ? { classId } : {}) },
        select: { nis: true, user: { select: { name: true } }, class: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      });
      people = students.map(s => ({ identifier: s.nis, name: s.user.name, className: s.class?.name ?? null }));
    } else if (type === "GURU") {
      const teachers = await prisma.teacher.findMany({
        select: { nip: true, user: { select: { name: true } } },
        orderBy: { user: { name: "asc" } },
      });
      people = teachers.map(t => ({ identifier: t.nip, name: t.user.name, className: null }));
    } else {
      const staff = await prisma.user.findMany({
        where: { role: { in: ["TAS", "ADMIN"] } },
        select: { name: true, email: true },
        orderBy: { name: "asc" },
      });
      people = staff.map(u => ({ identifier: u.email.split("@")[0], name: u.name, className: null }));
    }

    const withQr = await Promise.all(
      people.map(async (p) => ({ ...p, qr: await generateQrDataUrl(p.identifier) }))
    );

    return NextResponse.json(withQr);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    }
    console.error("[perpustakaan borrower-qr]", e);
    return NextResponse.json({ error: "Gagal membuat kartu anggota" }, { status: 500 });
  }
}
