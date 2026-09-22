import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { kegiatanMilik } from "@/lib/kegiatan-qr";
import { penerimaPengumuman } from "@/lib/pengumuman";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";

export const dynamic = "force-dynamic";

async function sasaranBernama(k: { targetRole: string; targetKelasIds: string[]; targetJurusanIds: string[]; targetJabatan: string[] }) {
  const s = await penerimaPengumuman(k);
  const u = await prisma.user.findMany({
    where: { id: { in: s.map(x => x.userId) } },
    select: { id: true, name: true, student: { select: { class: { select: { name: true } } } } },
  });
  const peta = new Map(u.map(x => [x.id, x]));
  return s.map(x => ({ userId: x.userId, peran: x.peran, nama: peta.get(x.userId)?.name ?? "-", kelas: peta.get(x.userId)?.student?.class?.name ?? "" }))
    .sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nama.localeCompare(b.nama));
}

/** Rekap hadir & belum hadir. ?format=xlsx untuk unduhan daftar hadir. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const [hadir, sasaran] = await Promise.all([
    prisma.presensiKegiatan.findMany({ where: { kegiatanId: id }, orderBy: { waktu: "asc" } }),
    sasaranBernama(m.k),
  ]);
  const sudah = new Set(hadir.map(h => h.userId));
  const belum = sasaran.filter(s => !sudah.has(s.userId));
  const kelasDari = new Map(sasaran.map(s => [s.userId, s.kelas]));
  if (new URL(req.url).searchParams.get("format") === "xlsx") {
    const jam = (d: Date) => d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    return balasanExcelBanyakSheet(`presensi-${m.k.mulai.toISOString().slice(0, 10)}`, [
      { nama: "Hadir", headers: ["No", "Nama", "Peran", "Kelas", "Jam", "Cara", "Keterangan"], rows: hadir.map((h, i) => [i + 1, h.nama, h.peran, kelasDari.get(h.userId) ?? "", jam(h.waktu), h.metode === "QR" ? "Pindai QR" : "Dicatat panitia", h.keterangan ?? ""]) },
      { nama: "Belum Hadir", headers: ["No", "Nama", "Peran", "Kelas"], rows: belum.map((b, i) => [i + 1, b.nama, b.peran, b.kelas]) },
    ]);
  }
  return Response.json({
    kegiatan: m.k,
    hadir: hadir.map(h => ({ ...h, kelas: kelasDari.get(h.userId) ?? "" })),
    belum, jumlahSasaran: sasaran.length,
  });
}

/** Catat manual (peserta tanpa HP / izin): {userId, keterangan}. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const u = await prisma.user.findUnique({ where: { id: String(b.userId ?? "") }, select: { id: true, name: true, role: true } });
  if (!u) return Response.json({ error: "Peserta tidak ditemukan." }, { status: 404 });
  const keterangan = String(b.keterangan ?? "").trim().slice(0, 200) || null;
  await prisma.presensiKegiatan.upsert({
    where: { kegiatanId_userId: { kegiatanId: id, userId: u.id } },
    create: { kegiatanId: id, userId: u.id, nama: u.name, peran: u.role, metode: "MANUAL", keterangan },
    update: { keterangan },
  });
  return Response.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySession();
  const { id } = await params;
  const m = await kegiatanMilik(id, session);
  if (!m) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const userId = new URL(req.url).searchParams.get("userId") ?? "";
  await prisma.presensiKegiatan.deleteMany({ where: { kegiatanId: id, userId } });
  return Response.json({ ok: true });
}
