import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, cekBentrokRuang, daftarRuang, lingkupDari, penerimaPengelola, sisaBarang } from "@/lib/sarpras-akses";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

const PILIH = {
  id: true, jenis: true, ruang: true, jumlah: true, peminjamNama: true, peminjamId: true, keperluan: true, mulai: true, selesai: true,
  status: true, lingkup: true, catatan: true, kondisiKembali: true, diputuskanOleh: true, createdAt: true,
  asset: { select: { id: true, name: true, location: true } },
} as const;

/** PEMINJAMAN BARANG & PEMESANAN RUANG. GET ?semua=1 (pengelola; Kepala Lab = lingkup LAB) atau milik sendiri.
 * GET ?ruang=&dari=&sampai= → jadwal pemakaian ruang (untuk kalender pemesanan). */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const u = new URL(req.url);
  const ruang = u.searchParams.get("ruang");
  if (ruang) {
    const dari = new Date(u.searchParams.get("dari") ?? Date.now());
    const sampai = new Date(u.searchParams.get("sampai") ?? dari.getTime() + 7 * 86400000);
    const pakai = await prisma.peminjamanSarpras.findMany({
      where: { jenis: "RUANG", ruang, status: { in: ["MENUNGGU", "DISETUJUI", "DIPINJAM"] }, mulai: { lt: sampai }, selesai: { gt: dari } },
      select: { mulai: true, selesai: true, status: true, peminjamNama: true, keperluan: true }, orderBy: { mulai: "asc" },
    });
    return Response.json({ pakai });
  }
  const semua = u.searchParams.get("semua") === "1" && a.kelola;
  const [daftar, aset] = await Promise.all([
    prisma.peminjamanSarpras.findMany({
      where: semua ? (a.penuh ? {} : { lingkup: "LAB" }) : { peminjamId: session.userId },
      orderBy: [{ mulai: "desc" }], take: 400, select: PILIH,
    }),
    prisma.asset.findMany({ where: { condition: { not: "RUSAK_BERAT" } }, select: { id: true, name: true, category: true, location: true, quantity: true }, orderBy: { name: "asc" } }),
  ]);
  return Response.json({ akses: a, daftar, aset, ruang: await daftarRuang() });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const b = await req.json().catch(() => ({}));
  const jenis = b.jenis === "RUANG" ? "RUANG" : "BARANG";
  const mulai = new Date(b.mulai), selesai = new Date(b.selesai);
  const keperluan = String(b.keperluan ?? "").trim().slice(0, 300);
  if (isNaN(mulai.getTime()) || isNaN(selesai.getTime()) || selesai <= mulai) return Response.json({ error: "Waktu mulai/selesai tidak valid." }, { status: 400 });
  if (selesai.getTime() - mulai.getTime() > 31 * 86400000) return Response.json({ error: "Lama peminjaman maksimal 31 hari." }, { status: 400 });
  if (selesai < new Date()) return Response.json({ error: "Waktu selesai sudah lewat." }, { status: 400 });
  if (keperluan.length < 3) return Response.json({ error: "Tulis keperluannya." }, { status: 400 });

  let lingkup = "SARPRAS", ruang: string | null = null, assetId: string | null = null, jumlah = 1, namaObjek = "";
  if (jenis === "RUANG") {
    ruang = String(b.ruang ?? "").trim();
    if (!ruang || !(await daftarRuang()).includes(ruang)) return Response.json({ error: "Pilih ruang dari daftar." }, { status: 400 });
    const bentrok = await cekBentrokRuang(ruang, mulai, selesai);
    if (bentrok.peminjaman.length || bentrok.jadwal.length) {
      const teks = [
        ...bentrok.peminjaman.map(p => `dipesan ${p.peminjamNama} (${p.keperluan})`),
        ...bentrok.jadwal.map(j => `jadwal pelajaran ${j}`),
      ].slice(0, 3).join("; ");
      return Response.json({ error: `Ruang ${ruang} sudah terpakai pada waktu itu: ${teks}.` }, { status: 409 });
    }
    lingkup = lingkupDari({ ruang });
    namaObjek = ruang;
  } else {
    const asset = await prisma.asset.findUnique({ where: { id: String(b.assetId ?? "") }, select: { id: true, name: true, category: true, location: true, quantity: true, condition: true } });
    if (!asset) return Response.json({ error: "Pilih barang dari daftar inventaris." }, { status: 400 });
    if (asset.condition === "RUSAK_BERAT") return Response.json({ error: "Barang sedang rusak berat." }, { status: 409 });
    jumlah = Math.max(1, Math.min(Number(b.jumlah) || 1, asset.quantity));
    const sisa = await sisaBarang(asset.id, asset.quantity, mulai, selesai);
    if (sisa < jumlah) return Response.json({ error: `Hanya ${Math.max(sisa, 0)} unit ${asset.name} yang tersedia pada waktu itu.` }, { status: 409 });
    assetId = asset.id; lingkup = lingkupDari({ asset }); namaObjek = asset.name;
  }
  const p = await prisma.peminjamanSarpras.create({
    data: { jenis, ruang, assetId, jumlah, lingkup, keperluan, mulai, selesai, peminjamId: session.userId, peminjamNama: session.name, catatan: String(b.catatan ?? "").trim().slice(0, 300) || null },
  });
  kirimLatar(async () => {
    await kirimNotifikasi({
      userIds: await penerimaPengelola(lingkup), jenis: "SARPRAS", kunci: `pinjam-baru:${p.id}`,
      judul: `Permohonan ${jenis === "RUANG" ? "pemakaian ruang" : "peminjaman"}: ${namaObjek}`,
      isi: `${session.name} · ${keperluan.slice(0, 80)} · ${mulai.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })}`,
      url: lingkup === "LAB" ? "/dashboard/teacher/lab/peminjaman" : "/dashboard/teacher/wakasek/sarpras/peminjaman", tag: `pinjam-${p.id}`,
    });
  });
  segarkanAntrean();
  return Response.json({ ok: true }, { status: 201 });
}
