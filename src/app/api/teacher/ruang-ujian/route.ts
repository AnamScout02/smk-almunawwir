import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bolehAturUjian } from "@/lib/kegiatan-ujian-server";
import { bacaRuang } from "@/lib/denah-ruang";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Daftar ruang ujian (semua petugas ujian boleh melihat). `dipakai` = jumlah kursi terisi di semua kegiatan. */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const [ruang, bolehAtur] = await Promise.all([
      prisma.ruangUjian.findMany({ orderBy: [{ urutan: "asc" }, { nama: "asc" }], include: { _count: { select: { penempatan: true } } } }),
      bolehAturUjian(session),
    ]);
    return Response.json({ ruang: ruang.map(({ _count, ...r }) => ({ ...r, dipakai: _count.penempatan })), bolehAtur });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    if (!(await bolehAturUjian(session))) {
      return Response.json({ error: "Hanya Administrator atau Wakil Kepala Kurikulum yang boleh mengatur ruang ujian." }, { status: 403 });
    }
    const d = bacaRuang(await req.json().catch(() => ({})));
    if ("error" in d) return Response.json({ error: d.error }, { status: 400 });
    if (await prisma.ruangUjian.findUnique({ where: { nama: d.nama }, select: { id: true } })) {
      return Response.json({ error: `Ruang "${d.nama}" sudah ada.` }, { status: 409 });
    }
    return Response.json(await prisma.ruangUjian.create({ data: d }), { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal menyimpan ruang." }, { status: 500 });
  }
}
