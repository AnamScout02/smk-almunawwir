import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import {
  bacaBiodataPegawai, PEGAWAI_TOP_FIELDS, PEGAWAI_BUKU_FIELDS, PEGAWAI_FIELD_LABELS,
} from "@/lib/biodata-pegawai";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

interface ChangeEntry { old: unknown; new: unknown; label: string }

function normalize(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return JSON.stringify(v);
  return String(v);
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["TEACHER", "TAS", "ADMIN"]);

    const menunggu = await prisma.pegawaiEditRequest.count({
      where: { userId: session.userId, status: "PENDING" },
    });
    if (menunggu > 0) {
      return Response.json({
        error: "Masih ada pengajuan yang belum diproses Tata Usaha. Tunggu sampai disetujui/ditolak sebelum mengajukan lagi.",
      }, { status: 409 });
    }

    const biodata = await bacaBiodataPegawai(session.userId);
    if (!biodata) return Response.json({ error: "Akun tidak ditemukan" }, { status: 404 });

    const body = await req.json() as { top?: Record<string, unknown>; buku?: Record<string, unknown> };
    const top = body.top ?? {};
    const buku = body.buku ?? {};

    const changes: Record<string, ChangeEntry> = {};

    for (const key of PEGAWAI_TOP_FIELDS) {
      if (!(key in top)) continue;
      if (normalize(biodata.top[key]) === normalize(top[key])) continue;
      changes[`top:${key}`] = { old: biodata.top[key] || null, new: top[key], label: PEGAWAI_FIELD_LABELS[key] ?? key };
    }

    for (const key of PEGAWAI_BUKU_FIELDS) {
      if (!(key in buku)) continue;
      if (normalize(biodata.buku[key]) === normalize(buku[key])) continue;
      changes[`buku:${key}`] = { old: biodata.buku[key] ?? null, new: buku[key], label: PEGAWAI_FIELD_LABELS[key] ?? key };
    }

    if (Object.keys(changes).length === 0) {
      return Response.json({ error: "Tidak ada perubahan yang diajukan." }, { status: 400 });
    }

    const dibuat = await prisma.pegawaiEditRequest.create({
      data: { userId: session.userId, changes: changes as object, status: "PENDING" },
      select: { id: true },
    });
    return Response.json({ success: true, id: dibuat.id }, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Gagal mengajukan perubahan" }, { status: 500 });
  }
}
