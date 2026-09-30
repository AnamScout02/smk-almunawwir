import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { STATUS, assertImam, petugasTanggal, sesiSah, tanggalKunci } from "@/lib/imam-sholat";
import { cekLibur } from "@/lib/hari-libur";

export const dynamic = "force-dynamic";

const isoSah = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

/** GET ?tanggal=YYYY-MM-DD — petugas hari itu beserta status kehadirannya. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertImam(session);
    const sp = new URL(req.url).searchParams;
    const tanggal = sp.get("tanggal") ?? new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    if (!isoSah(tanggal)) return NextResponse.json({ error: "Tanggal tidak sah." }, { status: 400 });

    const [petugas, libur] = await Promise.all([petugasTanggal(tanggal), cekLibur(tanggal)]);
    return NextResponse.json({ tanggal, petugas, libur: libur?.nama ?? null, status: STATUS });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kesiswaan / Pembina OSIS." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat presensi imam." }, { status: 500 });
  }
}

/** POST { tanggal, baris:[{userId, sesi, status, catatan}] } — simpan kehadiran petugas. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertImam(session);
    const { tanggal, baris } = await req.json() as { tanggal?: string; baris?: Record<string, string>[] };
    if (!tanggal || !isoSah(tanggal)) return NextResponse.json({ error: "Tanggal tidak sah." }, { status: 400 });

    const libur = await cekLibur(tanggal);
    if (libur) return NextResponse.json({ error: `Tanggal itu libur (${libur.nama}) — tidak ada jadwal imam.` }, { status: 400 });

    /* Hanya petugas yang MEMANG terjadwal hari itu yang boleh dicatat; kalau tidak, presensi bisa
       diisi untuk orang yang tidak pernah ditugaskan. Sama seperti absensi siswa yang dibatasi
       kelasnya (CLAUDE.md #10). */
    const terjadwal = new Set((await petugasTanggal(tanggal)).map(p => `${p.userId}|${p.sesi}`));
    const sah = (baris ?? []).filter(b =>
      b.userId && sesiSah(b.sesi) && (STATUS as readonly string[]).includes(b.status)
      && terjadwal.has(`${b.userId}|${b.sesi}`));
    if (sah.length === 0) return NextResponse.json({ error: "Tidak ada kehadiran yang bisa disimpan." }, { status: 400 });

    const tgl = tanggalKunci(tanggal);
    await prisma.$transaction(sah.map(b => prisma.presensiImam.upsert({
      where: { userId_date_sesi: { userId: b.userId, date: tgl, sesi: b.sesi } },
      create: { userId: b.userId, date: tgl, sesi: b.sesi, status: b.status, catatan: b.catatan?.trim() || null, dicatatOleh: session.name },
      update: { status: b.status, catatan: b.catatan?.trim() || null, dicatatOleh: session.name },
    })));

    await logActivity(session, {
      action: "UPDATE", entity: "PresensiImam",
      description: `${session.name} mencatat kehadiran ${sah.length} imam tanggal ${tanggal}`,
    });
    return NextResponse.json({ ok: true, tersimpan: sah.length });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kesiswaan / Pembina OSIS." }, { status: 403 });
    }
    console.error("[imam presensi POST]", e);
    return NextResponse.json({ error: "Gagal menyimpan presensi imam." }, { status: 500 });
  }
}
