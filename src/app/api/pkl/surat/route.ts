import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { nomorSuratBerikutnya } from "@/lib/nomor-surat-berikutnya";
import { balasTolak, sesiPkl } from "@/lib/pkl-server";
import { siapkanSuratPkl } from "@/lib/pkl-surat-server";

export const dynamic = "force-dynamic";

/** Surat & SPPD urusan PKL. Suratnya masuk BUKU AGENDA Tata Usaha (satu urutan nomor sekolah) — bukan penomoran sendiri. */
export async function GET() {
  try {
    await sesiPkl();
    const surat = await prisma.suratPkl.findMany({ orderBy: { createdAt: "desc" }, take: 300, select: { id: true, jenis: true, nomor: true, perihal: true, namaMitra: true, studentIds: true, dibuatOleh: true, createdAt: true } });
    return Response.json({ surat });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}

export async function POST(req: NextRequest) {
  try {
    const session = await sesiPkl();
    const x = await siapkanSuratPkl(await req.json().catch(() => ({})));
    if ("galat" in x) return Response.json({ error: x.galat }, { status: x.status });
    const nomor = await nomorSuratBerikutnya(x.klasifikasi, x.tanggal);
    let suratId: string | null = null, suratTugasId: string | null = null;
    if (x.tugas) {
      suratTugasId = (await prisma.suratTugas.create({ data: { nomor, tanggal: x.tanggal, ...x.tugas.data, inputById: session.userId, pegawai: { create: x.tugas.pegawai } }, select: { id: true } })).id;
    } else if (x.surat) {
      suratId = (await prisma.surat.create({ data: { tipe: "KELUAR", nomor, tanggal: x.tanggal, perihal: x.perihal, klasifikasi: x.klasifikasi, isRead: true, ...x.surat }, select: { id: true } })).id;
    }
    const tautan = await prisma.suratPkl.create({
      data: { jenis: x.isian.jenis, suratId, suratTugasId, nomor, perihal: x.perihal, mitraIds: x.isian.mitraIds, namaMitra: x.namaMitra, studentIds: x.isian.studentIds, data: x.isian, dibuatOleh: session.name },
    });
    await logActivity(session, { action: "CREATE", entity: x.tugas ? "SuratTugas" : "Surat", entityId: suratTugasId ?? suratId ?? undefined, description: `Surat PKL ${nomor}: ${x.perihal} — ${x.namaMitra}` }).catch(() => null);
    return Response.json({ id: tautan.id, nomor }, { status: 201 });
  } catch (e) { lemparBilaPengalihan(e); return balasTolak(e); }
}
