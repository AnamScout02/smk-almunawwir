import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const subjects = await prisma.subject.findMany({
      include: { major: { select: { id: true, name: true, code: true } } },
      orderBy: [{ grade: "asc" }, { category: "asc" }, { order: "asc" }, { code: "asc" }],
    });
    return NextResponse.json(subjects);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const body = await req.json();
    const { code, name, category, grade, majorId, order, hoursPerWeek, weekGroup, maxSharedTeacher, kkm, namaArab } = body;

    if (!name || !category || !grade) {
      return NextResponse.json({ error: "Nama, kategori, dan tingkat wajib diisi" }, { status: 400 });
    }

    // KKM/KKTP mapel: kosong = ikut KKM bawaan sekolah (17 Sep 2026).
    const kkmTeks = kkm === undefined || kkm === null ? "" : String(kkm).trim();
    const nilaiKkm = kkmTeks === "" ? null : Number(kkmTeks);
    if (nilaiKkm !== null && !(Number.isInteger(nilaiKkm) && nilaiKkm >= 1 && nilaiKkm <= 100)) {
      return NextResponse.json({ error: "KKM harus bilangan bulat 1–100, atau kosongkan untuk memakai KKM bawaan sekolah." }, { status: 400 });
    }

    const subject = await prisma.subject.create({
      data: {
        code: code ? parseInt(String(code)) : 0,
        name,
        category,
        grade: parseInt(String(grade)),
        majorId: majorId || null,
        order: order ? parseInt(String(order)) : 0,
        hoursPerWeek: hoursPerWeek ? parseInt(String(hoursPerWeek)) : 2,
        weekGroup: weekGroup === "PRODUKTIF" ? "PRODUKTIF" : "UMUM",
        maxSharedTeacher: maxSharedTeacher ? Math.max(1, parseInt(String(maxSharedTeacher))) : 1,
        kkm: nilaiKkm,
        // Nama Arab mapel Diniyah — kolom مادة di Rapor Diniyah (makro: MATA PELAJARAN kolom M).
        ...(namaArab !== undefined ? { namaArab: typeof namaArab === "string" && namaArab.trim() ? namaArab.trim().slice(0, 120) : null } : {}),
      },
      include: { major: { select: { id: true, name: true, code: true } } },
    });
    return NextResponse.json(subject, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal menyimpan mata pelajaran" }, { status: 500 });
  }
}
