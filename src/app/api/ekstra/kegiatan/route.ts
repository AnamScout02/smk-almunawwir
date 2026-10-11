import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { bolehEkskul, ekskulBoleh, hapusBerkasFoto, hariWibIso, tambahFotoKegiatan } from "@/lib/ekstra-server";

export const dynamic = "force-dynamic";
const tglSah = (t: unknown): t is string => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t);

/** Daftar pertemuan + foto bukti kegiatan (`?extracurricularId=&bulan=YYYY-MM`; tanpa id = semua ekskul yang boleh dilihat). */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const { akses, daftar } = await ekskulBoleh(session);
  if (!akses.masuk) return Response.json({ error: "Tidak diizinkan." }, { status: 403 });
  const q = new URL(req.url).searchParams, id = q.get("extracurricularId");
  const bulan = /^\d{4}-\d{2}$/.test(q.get("bulan") ?? "") ? (q.get("bulan") as string) : hariWibIso().slice(0, 7);
  const [y, m] = bulan.split("-").map(Number);
  const ids = id ? daftar.filter(d => d.id === id).map(d => d.id) : daftar.map(d => d.id);
  const jurnal = await prisma.extracurricularJournal.findMany({
    where: { extracurricularId: { in: ids }, date: { gte: new Date(Date.UTC(y, m - 1, 1)), lt: new Date(Date.UTC(y, m, 1)) } },
    orderBy: { date: "desc" },
    select: { id: true, extracurricularId: true, date: true, materi: true, foto: true, sumber: true, recordedByName: true, recordedByRole: true, entries: { select: { status: true } } },
  });
  return Response.json({
    bulan, kelola: akses.kelola, ekskul: daftar.map(d => ({ id: d.id, nama: d.name })),
    kegiatan: jurnal.map(j => ({
      id: j.id, extracurricularId: j.extracurricularId, tanggal: j.date.toISOString().slice(0, 10), materi: j.materi, foto: j.foto, sumber: j.sumber, oleh: j.recordedByName, peran: j.recordedByRole,
      hadir: j.entries.filter(e => e.status === "HADIR").length, peserta: j.entries.length,
    })),
  });
}

/** Unggah satu foto bukti kegiatan (multipart: extracurricularId, tanggal, file) — koordinator atau pembina ekskul itu. */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const fd = await req.formData().catch(() => null);
  const id = String(fd?.get("extracurricularId") ?? ""), tanggal = fd?.get("tanggal");
  const { ekskul } = await bolehEkskul(session, id);
  if (!ekskul) return Response.json({ error: "Anda tidak mengelola ekstrakurikuler ini." }, { status: 403 });
  if (!tglSah(tanggal) || tanggal > hariWibIso()) return Response.json({ error: "Tanggal kegiatan tidak valid." }, { status: 400 });
  const h = await tambahFotoKegiatan({ extracurricularId: id, tanggal, file: fd?.get("file"), olehNama: session.name, olehPeran: session.role });
  if ("galat" in h) return Response.json({ error: h.galat }, { status: 400 });
  return Response.json(h, { status: 201 });
}

/** Hapus satu foto (`?journalId=&url=`). */
export async function DELETE(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  const q = new URL(req.url).searchParams, url = q.get("url") ?? "";
  const j = await prisma.extracurricularJournal.findUnique({ where: { id: q.get("journalId") ?? "" }, select: { id: true, extracurricularId: true, foto: true } });
  if (!j || !j.foto.includes(url)) return Response.json({ error: "Foto tidak ditemukan." }, { status: 404 });
  if (!(await bolehEkskul(session, j.extracurricularId)).ekskul) return Response.json({ error: "Anda tidak mengelola ekstrakurikuler ini." }, { status: 403 });
  await prisma.extracurricularJournal.update({ where: { id: j.id }, data: { foto: j.foto.filter(f => f !== url) } });
  await hapusBerkasFoto(url);
  return Response.json({ ok: true });
}
