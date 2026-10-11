import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { ekskulBoleh } from "@/lib/ekstra-server";
import { KUNCI_DAFTAR, pendaftarMenunggu, putuskanPendaftaran, setelanDaftarEkstra } from "@/lib/ekstra-siswa";
import { kirimNotifikasi } from "@/lib/push-server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Pendaftar ekskul yang menunggu keputusan — koordinator melihat semua, pembina hanya ekskulnya. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { akses, daftar } = await ekskulBoleh(session);
  if (!akses.masuk) return Response.json({ error: "Menu ini untuk koordinator dan pembina ekstrakurikuler." }, { status: 403 });
  const ids = daftar.map(d => d.id);
  const [menunggu, riwayat, setelan, rinci] = await Promise.all([
    pendaftarMenunggu(akses.kelola ? null : ids),
    prisma.pendaftaranEkstra.findMany({
      where: { status: { not: "MENUNGGU" }, extracurricularId: { in: ids } }, orderBy: { diputusAt: "desc" }, take: 30,
      select: { id: true, status: true, catatan: true, diputusOleh: true, diputusAt: true, extracurricularId: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } },
    }),
    setelanDaftarEkstra(),
    prisma.extracurricular.findMany({ where: { id: { in: ids } }, select: { id: true, bukaDaftar: true, kuota: true } }),
  ]);
  return Response.json({
    kelola: akses.kelola, setelan,
    ekskul: daftar.map(d => { const r = rinci.find(x => x.id === d.id); return { id: d.id, nama: d.name, anggota: d._count.members, kuota: r?.kuota ?? null, buka: r?.bukaDaftar ?? true }; }),
    menunggu,
    riwayat: riwayat.map(r => ({ id: r.id, ekskulId: r.extracurricularId, nama: r.student.user.name, kelas: r.student.class?.name ?? "", status: r.status, catatan: r.catatan, oleh: r.diputusOleh, pada: r.diputusAt?.toISOString() ?? null })),
  });
}

/** `{ids, terima, catatan}` memutuskan pendaftaran; `{setelan: {dibuka, maks}}` (khusus koordinator) membuka/menutup. */
export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { akses, daftar } = await ekskulBoleh(session);
  if (!akses.masuk) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({})) as { ids?: unknown; terima?: unknown; catatan?: unknown; setelan?: { dibuka?: unknown; maks?: unknown } };
  if (b.setelan) {
    if (!akses.kelola) return Response.json({ error: "Khusus Koordinator Ekstrakurikuler." }, { status: 403 });
    const maks = Math.round(Number(b.setelan.maks));
    if (!Number.isFinite(maks) || maks < 1 || maks > 10) return Response.json({ error: "Jumlah pilihan per siswa harus 1–10." }, { status: 400 });
    const simpan = (key: string, value: string) => prisma.siteSetting.upsert({ where: { key }, create: { key, value }, update: { value } });
    await simpan(KUNCI_DAFTAR.dibuka, b.setelan.dibuka ? "1" : "0");
    await simpan(KUNCI_DAFTAR.maks, String(maks));
    await logActivity(session, { action: "UPDATE", entity: "Extracurricular", description: `Pendaftaran ekstrakurikuler ${b.setelan.dibuka ? "dibuka" : "ditutup"}, maks ${maks} pilihan` }).catch(() => null);
    return Response.json({ ok: true });
  }
  const ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter(Boolean).slice(0, 300);
  if (!ids.length) return Response.json({ error: "Tidak ada pendaftar yang dipilih." }, { status: 400 });
  const terima = b.terima === true;
  const catatan = typeof b.catatan === "string" ? b.catatan.trim().slice(0, 300) || null : null;
  const h = await putuskanPendaftaran({ ids, terima, catatan, oleh: session.name, ekskulIds: akses.kelola ? null : daftar.map(d => d.id), kirim: kirimNotifikasi });
  await logActivity(session, { action: "UPDATE", entity: "Extracurricular", description: `${terima ? "Menerima" : "Menolak"} pendaftar ekstrakurikuler: ${h.diterima} diterima, ${h.ditolak} ditolak` }).catch(() => null);
  return Response.json({ ok: true, ...h });
}
