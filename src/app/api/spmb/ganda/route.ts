import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { assertSpmb } from "@/lib/spmb";
import { kunciPasangan } from "@/lib/spmb-ganda";
import { bacaAbaikan, kelompokGandaSpmb, simpanAbaikan } from "@/lib/spmb-ganda-server";

export const dynamic = "force-dynamic";

/** PENDAFTAR DIDUGA GANDA (8 Okt 2026) — daftar untuk DIPERIKSA panitia; tidak ada yang dihapus otomatis. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const { kelompok, diabaikan } = await kelompokGandaSpmb();
    const ids = [...new Set(kelompok.flatMap(k => k.anggota))];
    const baris = ids.length ? await prisma.admission.findMany({
      where: { id: { in: ids } },
      select: {
        id: true, nomor: true, fullName: true, birthDate: true, birthPlace: true, nik: true, nisn: true, phone: true,
        previousSchool: true, chosenMajor: true, status: true, verifikasiStatus: true, createdAt: true, studentId: true,
        gelombang: { select: { nama: true } },
        _count: { select: { pembayaranSpmb: true } },
      },
    }) : [];
    const peta = new Map(baris.map(b => [b.id, {
      id: b.id, nomor: b.nomor, nama: b.fullName, lahir: b.birthDate.toISOString().slice(0, 10), tempatLahir: b.birthPlace,
      nik: b.nik, nisn: b.nisn, phone: b.phone, sekolahAsal: b.previousSchool, jurusan: b.chosenMajor, status: b.status,
      verifikasiStatus: b.verifikasiStatus, daftar: b.createdAt, sudahSiswa: !!b.studentId, gelombang: b.gelombang?.nama ?? null,
      pembayaran: b._count.pembayaranSpmb,
    }]));
    return NextResponse.json({
      diabaikan,
      kelompok: kelompok.map(k => ({
        pasti: k.pasti, alasan: k.alasan, pasangan: k.pasangan,
        anggota: k.anggota.map(id => peta.get(id)).filter(Boolean)
          .sort((a, b) => new Date(a!.daftar).getTime() - new Date(b!.daftar).getTime()),
      })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}

/** { aksi: "abaikan", ids: [...] } — seluruh pasangan di antara baris itu dinyatakan BUKAN ganda.
 *  { aksi: "pulihkan" } — hapus semua tanda "bukan ganda" (kelompok yang pernah disingkirkan tampil lagi). */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertSpmb(session);
    const body = await req.json().catch(() => ({}));
    if (body?.aksi === "pulihkan") {
      await simpanAbaikan([]);
      await logActivity(session, { action: "UPDATE", entity: "Admission", description: "Memulihkan semua tanda \"bukan ganda\" pendaftar SPMB" }).catch(() => null);
      return NextResponse.json({ ok: true });
    }
    if (body?.aksi !== "abaikan") return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
    const ids: string[] = Array.isArray(body.ids) ? [...new Set((body.ids as unknown[]).filter((x): x is string => typeof x === "string"))].slice(0, 20) : [];
    if (ids.length < 2) return NextResponse.json({ error: "Pilih minimal dua pendaftar" }, { status: 400 });
    const ada = await prisma.admission.findMany({ where: { id: { in: ids } }, select: { id: true, fullName: true, nomor: true } });
    if (ada.length !== ids.length) return NextResponse.json({ error: "Pendaftar tidak ditemukan" }, { status: 404 });
    const baru: string[] = [];
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) baru.push(kunciPasangan(ids[i], ids[j]));
    await simpanAbaikan([...(await bacaAbaikan()), ...baru]);
    await logActivity(session, {
      action: "UPDATE", entity: "Admission",
      description: `Menandai bukan pendaftar ganda: ${ada.map(a => `${a.fullName} (${a.nomor ?? "tanpa nomor"})`).join(", ")}`,
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Tidak berwenang" }, { status: 403 });
  }
}
