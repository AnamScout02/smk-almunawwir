import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { cariAnggota } from "@/lib/perpustakaan-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

const JEDA_ULANG_MS = 30 * 60_000;

function awalHariWib() {
  const wib = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000);
}

async function rekapHariIni() {
  const awal = awalHariWib();
  const [jumlah, terakhir] = await Promise.all([
    prisma.libraryVisit.count({ where: { visitedAt: { gte: awal } } }),
    prisma.libraryVisit.findMany({
      where: { visitedAt: { gte: awal } }, orderBy: { visitedAt: "desc" }, take: 10,
      select: { id: true, visitedAt: true, user: { select: { name: true, student: { select: { class: { select: { name: true } } } } } } },
    }),
  ]);
  return {
    hariIni: jumlah,
    terakhir: terakhir.map(v => ({
      id: v.id, nama: v.user.name, kelas: v.user.student?.class?.name ?? null,
      jam: v.visitedAt.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }),
    })),
  };
}

/** KIOSK KUNJUNGAN — rekap hari ini. */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);
    return NextResponse.json(await rekapHariIni());
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Pindai kartu pengunjung → catat kunjungan. Pindai ulang orang yang sama dalam 30 menit tidak dihitung dua kali. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertPerpustakaan(session);
    const { kode } = (await req.json().catch(() => ({}))) as { kode?: string };
    const anggota = await cariAnggota(kode ?? "");
    if (!anggota) return NextResponse.json({ error: `Kartu "${(kode ?? "").trim()}" tidak dikenali.` }, { status: 404 });
    const baru = await prisma.libraryVisit.findFirst({ where: { userId: anggota.id, visitedAt: { gte: new Date(Date.now() - JEDA_ULANG_MS) } }, select: { id: true } });
    if (!baru) await prisma.libraryVisit.create({ data: { userId: anggota.id } });
    return NextResponse.json({ hasil: baru ? "SUDAH" : "TERCATAT", anggota, ...(await rekapHariIni()) }, { status: baru ? 200 : 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return NextResponse.json({ error: "Khusus Koordinator/Tim Perpustakaan." }, { status: 403 });
    return NextResponse.json({ error: "Gagal mencatat kunjungan." }, { status: 500 });
  }
}
