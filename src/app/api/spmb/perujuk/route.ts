import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { assertSpmb } from "@/lib/spmb";
import { JENIS_PERUJUK, kodeAngkaBaru, rapikanKode } from "@/lib/spmb-perujuk";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const daftar = await prisma.perujukSpmb.findMany({
      orderBy: [{ jenis: "asc" }, { nama: "asc" }],
      include: { _count: { select: { pendaftar: true } } },
    });
    // Berapa yang akhirnya DITERIMA per perujuk — angka yang sebenarnya dicari panitia.
    const diterima = await prisma.admission.groupBy({
      by: ["perujukId"],
      where: { perujukId: { not: null }, status: { in: ["DITERIMA", "ACCEPTED"] } },
      _count: { _all: true },
    }).catch(() => []);
    const petaDiterima = new Map(diterima.map(d => [d.perujukId, d._count._all]));
    return NextResponse.json(daftar.map(p => ({ ...p, diterima: petaDiterima.get(p.id) ?? 0 })));
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
    if (!nama) return NextResponse.json({ error: "Nama perujuk wajib diisi" }, { status: 400 });

    // Kode dikosongkan = dibuatkan ANGKA 6 digit. Perujuk luar tidak punya NIS/NIP, dan meminta
    // panitia mengarang kode sendiri menghasilkan kode yang panjang & sulit didiktekan.
    const diketik = rapikanKode(String(b?.kode ?? ""));
    const kode = diketik || await kodeAngkaBaru();
    if (kode.length < 3) return NextResponse.json({ error: "Kode minimal 3 karakter" }, { status: 400 });
    const jenis = (JENIS_PERUJUK as readonly string[]).includes(b?.jenis) ? b.jenis : "LUAR";

    const bentrok = await prisma.perujukSpmb.findUnique({ where: { kode }, select: { nama: true } });
    if (bentrok) return NextResponse.json({ error: `Kode "${kode}" sudah dipakai ${bentrok.nama}.` }, { status: 409 });

    const r = await prisma.perujukSpmb.create({
      data: {
        kode, nama, jenis,
        kontak: String(b?.kontak ?? "").trim() || null,
        keterangan: String(b?.keterangan ?? "").trim() || null,
        aktif: b?.aktif !== false,
      },
    });
    await logActivity(session, { action: "CREATE", entity: "PerujukSpmb", entityId: r.id, description: `Menambah perujuk SPMB "${nama}" (${kode})` });
    return NextResponse.json({ ok: true, id: r.id, kode: r.kode });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyimpan" }, { status: 500 });
  }
}
