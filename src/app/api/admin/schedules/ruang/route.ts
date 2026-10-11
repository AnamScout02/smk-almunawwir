import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { daftarRuang } from "@/lib/sarpras-akses";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** RUANG PER MAPEL (11 Okt 2026). `Schedule.room` kosong di SELURUH jadwal, sehingga papan TV lab, pemesanan ruang
 *  (cek bentrok dengan jadwal), dan daftar ruang tidak punya data. Mengisi ruang per baris jadwal (1.500+ baris) tidak
 *  masuk akal — di sini ruang diisi sekali per KELAS × MAPEL dan berlaku untuk semua jamnya (BLOK maupun NONBLOK). */
export async function GET() {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const [jadwal, ruang, kelas] = await Promise.all([
      prisma.schedule.groupBy({ by: ["classId", "subject", "room"], where: { scheduleType: "BLOK" }, _count: { _all: true } }),
      daftarRuang().catch(() => [] as string[]),
      prisma.class.findMany({ orderBy: [{ grade: "asc" }, { name: "asc" }], select: { id: true, name: true, grade: true, major: { select: { code: true } } } }),
    ]);
    const peta = new Map<string, { classId: string; mapel: string; jam: number; ruang: Set<string> }>();
    for (const j of jadwal) {
      const k = `${j.classId}|${j.subject}`, x = peta.get(k) ?? { classId: j.classId, mapel: j.subject, jam: 0, ruang: new Set<string>() };
      x.jam += j._count._all; if (j.room?.trim()) x.ruang.add(j.room.trim()); peta.set(k, x);
    }
    return Response.json({
      ruang, kelas: kelas.map(k => ({ id: k.id, nama: k.name, tingkat: k.grade, jurusan: k.major?.code ?? "" })),
      // `ruang` = satu nama bila seragam, "" bila kosong, "(campuran)" bila jam-jamnya berbeda ruang.
      baris: [...peta.values()].map(x => ({ classId: x.classId, mapel: x.mapel, jam: x.jam, ruang: x.ruang.size === 0 ? "" : x.ruang.size === 1 ? [...x.ruang][0] : "(campuran)" })),
    });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
  }
}

/** `{isi: [{classId, mapel, ruang}]}` — ruang "" mengosongkan. Nama ruang bebas (ruang baru boleh diketik), maks 60 huruf. */
export async function PUT(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
    await assertKurikulum(session);
    const b = await req.json().catch(() => ({})) as { isi?: unknown };
    const isi = (Array.isArray(b.isi) ? b.isi : []).slice(0, 600).map(x => {
      const o = x as Record<string, unknown>;
      return { classId: String(o.classId ?? ""), mapel: String(o.mapel ?? ""), ruang: String(o.ruang ?? "").trim().slice(0, 60) };
    }).filter(x => x.classId && x.mapel && x.ruang !== "(campuran)");
    if (!isi.length) return Response.json({ error: "Tidak ada yang diubah." }, { status: 400 });
    let jumlah = 0;
    await prisma.$transaction(async tx => {
      for (const x of isi) jumlah += (await tx.schedule.updateMany({ where: { classId: x.classId, subject: x.mapel }, data: { room: x.ruang || null } })).count;
    });
    await logActivity(session, { action: "UPDATE", entity: "Schedule", description: `Mengisi ruang ${isi.length} kelas-mapel (${jumlah} jam jadwal)` }).catch(() => null);
    return Response.json({ ok: true, kelasMapel: isi.length, jam: jumlah });
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Khusus Wakil Kepala Kurikulum." }, { status: 403 });
  }
}
