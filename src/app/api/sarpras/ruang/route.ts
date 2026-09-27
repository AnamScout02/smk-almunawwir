import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, daftarRuang } from "@/lib/sarpras-akses";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Daftar ruang untuk pemesanan. PUT (pengelola penuh): ruang tambahan di luar jadwal & ruang ujian (Aula, Masjid, Lapangan …). */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const [ruang, set] = await Promise.all([daftarRuang(), prisma.siteSetting.findUnique({ where: { key: "sarpras.ruangTambahan" } })]);
  let tambahan: string[] = [];
  try { tambahan = JSON.parse(set?.value ?? "[]"); } catch { tambahan = []; }
  const a = await aksesSarpras(session);
  return Response.json({ ruang, tambahan: a.penuh ? tambahan : undefined });
}

export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.penuh) return Response.json({ error: "Khusus pengelola Sarpras." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const tambahan = Array.isArray(b.tambahan) ? [...new Set(b.tambahan.map((x: unknown) => String(x).trim()).filter(Boolean))].slice(0, 100) : [];
  await prisma.siteSetting.upsert({ where: { key: "sarpras.ruangTambahan" }, create: { key: "sarpras.ruangTambahan", value: JSON.stringify(tambahan) }, update: { value: JSON.stringify(tambahan) } });
  return Response.json({ ok: true });
}

/** UBAH NAMA RUANG DARI SATU TEMPAT (25 September 2026, permintaan user: "penambahan ruang semua fokus di sini
 * dan bisa diedit, di tempat lain baru ikut daftar ini").
 *
 * Nama ruang tersimpan di BEBERAPA tempat sekaligus — kolom `Schedule.room`, baris `RuangUjian`, daftar tambahan
 * Sarpras, dan kolom `Layar.ruang`. Sebelumnya mengubah nama berarti menyunting satu per satu di modul
 * masing-masing, dan yang terlewat langsung menjadi ruang "baru" yang berdiri sendiri — itulah asal mula
 * "Ruang 1" dan "Lab TKJ" hidup berdampingan padahal ruangan yang sama.
 *
 * Rute ini mengganti nama di SEMUA tempat itu dalam satu transaksi. Kalau salah satu gagal, tidak ada yang
 * berubah — lebih baik gagal utuh daripada separuh berganti dan separuh tidak. */
export async function PATCH(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  if (!a.penuh) return Response.json({ error: "Khusus pengelola Sarpras." }, { status: 403 });

  const b = await req.json().catch(() => ({})) as { lama?: string; baru?: string };
  const lama = (b.lama ?? "").trim();
  const baru = (b.baru ?? "").trim();
  if (!lama || !baru) return Response.json({ error: "Nama lama & baru wajib diisi." }, { status: 400 });
  if (lama === baru) return Response.json({ ok: true, tidakBerubah: true });

  const semua = await daftarRuang();
  if (semua.some(r => r.toLowerCase() === baru.toLowerCase())) {
    return Response.json({ error: `Sudah ada ruang bernama "${baru}".` }, { status: 409 });
  }

  const set = await prisma.siteSetting.findUnique({ where: { key: "sarpras.ruangTambahan" } });
  let tambahan: string[] = [];
  try { tambahan = JSON.parse(set?.value ?? "[]"); } catch { tambahan = []; }

  const hasil = await prisma.$transaction(async (tx) => {
    const jadwal = await tx.schedule.updateMany({ where: { room: lama }, data: { room: baru } });
    const ujian = await tx.ruangUjian.updateMany({ where: { nama: lama }, data: { nama: baru } });
    const layar = await tx.layar.updateMany({ where: { ruang: lama }, data: { ruang: baru } });
    const pinjam = await tx.peminjamanSarpras.updateMany({ where: { jenis: "RUANG", ruang: lama }, data: { ruang: baru } });
    if (tambahan.includes(lama)) {
      const daftarBaru = tambahan.map(t => (t === lama ? baru : t));
      await tx.siteSetting.upsert({
        where: { key: "sarpras.ruangTambahan" },
        create: { key: "sarpras.ruangTambahan", value: JSON.stringify(daftarBaru) },
        update: { value: JSON.stringify(daftarBaru) },
      });
    }
    return { jadwal: jadwal.count, ujian: ujian.count, layar: layar.count, pinjam: pinjam.count };
  });

  await logActivity(session, {
    action: "UBAH_NAMA_RUANG", entity: "Ruang", entityId: baru,
    description: `Mengubah nama ruang "${lama}" menjadi "${baru}" (jadwal ${hasil.jadwal}, ruang ujian ${hasil.ujian}, TV ${hasil.layar}, pemesanan ${hasil.pinjam})`,
  });
  return Response.json({ ok: true, ...hasil });
}
