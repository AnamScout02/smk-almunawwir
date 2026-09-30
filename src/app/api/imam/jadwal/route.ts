import { NextRequest, NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { logActivity } from "@/lib/activity-log";
import { HARI, SESI, SLOT, assertImam, sesiSah, slotSah } from "@/lib/imam-sholat";

export const dynamic = "force-dynamic";

const HARI_KERJA = HARI.filter(h => h !== "MINGGU");

/** GET — seluruh jadwal + daftar orang yang bisa dipilih (guru & staf, BUKAN siswa). */
export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertImam(session);
    const [jadwal, orang] = await Promise.all([
      prisma.jadwalImam.findMany({
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: [{ sesi: "asc" }, { slot: "asc" }],
      }),
      prisma.user.findMany({
        where: { role: { in: ["TEACHER", "TAS", "ADMIN"] } },
        select: { id: true, name: true, role: true, teacher: { select: { gender: true } } },
        orderBy: { name: "asc" },
      }),
    ]);
    return NextResponse.json({
      hari: HARI_KERJA, sesi: SESI, slot: SLOT,
      jadwal: jadwal.map(j => ({ id: j.id, day: j.day, weekType: j.weekType, sesi: j.sesi, slot: j.slot, userId: j.userId, nama: j.user.name, catatan: j.catatan })),
      orang: orang.map(o => ({ id: o.id, nama: o.name, role: o.role, jk: o.teacher?.gender ?? null })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kesiswaan / Pembina OSIS." }, { status: 403 });
    }
    return NextResponse.json({ error: "Gagal memuat jadwal imam." }, { status: 500 });
  }
}

/** PUT — isi/ubah SATU slot (hari × minggu × sesi × slot). Kirim userId kosong untuk mengosongkan. */
export async function PUT(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    await assertImam(session);
    const { day, weekType, sesi, slot, userId, catatan } = await req.json() as Record<string, string>;

    if (!HARI_KERJA.includes(day as (typeof HARI_KERJA)[number])) return NextResponse.json({ error: "Hari tidak sah." }, { status: 400 });
    if (!["A", "B", "SEMUA"].includes(weekType)) return NextResponse.json({ error: "Jenis minggu tidak sah." }, { status: 400 });
    if (!sesiSah(sesi) || !slotSah(sesi, slot)) return NextResponse.json({ error: "Sesi atau slot tidak sah." }, { status: 400 });

    const kunci = { day_weekType_sesi_slot: { day, weekType, sesi, slot } };

    if (!userId) {
      await prisma.jadwalImam.deleteMany({ where: { day, weekType, sesi, slot } });
      await logActivity(session, { action: "UPDATE", entity: "JadwalImam", description: `${session.name} mengosongkan imam ${sesi} ${slot} hari ${day} (minggu ${weekType})` });
      return NextResponse.json({ ok: true, kosong: true });
    }

    const orang = await prisma.user.findFirst({
      where: { id: userId, role: { in: ["TEACHER", "TAS", "ADMIN"] } },
      select: { id: true, name: true, teacher: { select: { gender: true } } },
    });
    if (!orang) return NextResponse.json({ error: "Petugas tidak ditemukan." }, { status: 400 });

    /* Slot Dzuhur memisahkan jamaah putra & putri, jadi jenis kelamin yang keliru hampir pasti
       salah pilih. Ditolak HANYA bila jenis kelaminnya memang tercatat — banyak akun staf belum
       mengisinya, dan memblokir data yang kosong akan membuat jadwal tidak bisa disusun. */
    const jk = orang.teacher?.gender;
    if (sesi === "DZUHUR" && jk && jk !== slot) {
      return NextResponse.json(
        { error: `${orang.name} tercatat ${jk === "L" ? "laki-laki" : "perempuan"}, tidak cocok untuk ${slot === "L" ? "Imam Putra" : "Imam Putri"}.` },
        { status: 400 },
      );
    }

    await prisma.jadwalImam.upsert({
      where: kunci,
      create: { day, weekType, sesi, slot, userId, catatan: catatan?.trim() || null },
      update: { userId, catatan: catatan?.trim() || null },
    });
    await logActivity(session, { action: "UPDATE", entity: "JadwalImam", description: `${session.name} menetapkan ${orang.name} sebagai imam ${sesi} (${slot}) hari ${day}, minggu ${weekType}` });
    return NextResponse.json({ ok: true });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Khusus Wakil Kepala Kesiswaan / Pembina OSIS." }, { status: 403 });
    }
    console.error("[imam jadwal PUT]", e);
    return NextResponse.json({ error: "Gagal menyimpan jadwal imam." }, { status: 500 });
  }
}
