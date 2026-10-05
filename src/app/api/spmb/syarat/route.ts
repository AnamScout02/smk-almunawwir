import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Dokumen yang harus diunggah pendaftar. Daftar KOSONG tidak menutup pendaftaran — pelajaran
 *  dari modul PKL (CLAUDE.md #91): tabel syarat yang kosong dulu membuat tidak ada satu pun siswa
 *  yang bisa mendaftar. Calon tetap bisa mengisi formulir; unggahan menyusul. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const syarat = await prisma.dokumenSyaratSpmb.findMany({
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      include: { _count: { select: { berkas: true } } },
    });
    return NextResponse.json(syarat);
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const b = await req.json();
    const nama = String(b?.nama ?? "").trim();
    if (!nama) return NextResponse.json({ error: "Nama dokumen wajib diisi" }, { status: 400 });
    const terakhir = await prisma.dokumenSyaratSpmb.findFirst({ orderBy: { urutan: "desc" }, select: { urutan: true } });
    const d = await prisma.dokumenSyaratSpmb.create({
      data: {
        nama,
        keterangan: String(b?.keterangan ?? "").trim() || null,
        wajib: b?.wajib !== false,
        urutan: (terakhir?.urutan ?? 0) + 1,
        aktif: b?.aktif !== false,
      },
    });
    await logActivity(session, { action: "CREATE", entity: "DokumenSyaratSpmb", entityId: d.id, description: `Menambah dokumen syarat SPMB "${nama}"` });
    return NextResponse.json({ ok: true, id: d.id });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
