import { verifyRole } from "@/lib/dal";
import { assertKedisiplinan } from "@/lib/kedisiplinan-guard";
import { susunKehadiranGuru, cakupanTingkat, KETERANGAN_TEMUAN } from "@/lib/kehadiran-guru";
import { bagianWib } from "@/lib/waktu-wib";
import { assertJabatan } from "@/lib/jabatan-guard";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** KEHADIRAN GURU TERPADU — menyandingkan presensi harian TU, catatan piket per jam, jurnal guru,
 * dan kehadiran petugas piket, lalu menandai ketidakcocokan antar lapisan. Hanya MEMBACA. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  try {
    await assertKedisiplinan(session);
  } catch (e) {
    lemparBilaPengalihan(e);
    return Response.json({ error: "Tidak punya akses" }, { status: 403 });
  }

  const url = new URL(req.url);
  const hariIni = bagianWib().iso;
  const tgl = /^\d{4}-\d{2}-\d{2}$/;
  const sampai = tgl.test(url.searchParams.get("sampai") ?? "") ? url.searchParams.get("sampai")! : hariIni;
  const bawaanDari = new Date(new Date(`${sampai}T00:00:00Z`).getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const dari = tgl.test(url.searchParams.get("dari") ?? "") ? url.searchParams.get("dari")! : bawaanDari;
  if (dari > sampai) return Response.json({ error: "Tanggal awal melewati tanggal akhir" }, { status: 400 });

  const [baris, tingkat] = await Promise.all([
    susunKehadiranGuru({ dari, sampai }),
    cakupanTingkat(),
  ]);
  return Response.json({ dari, sampai, tingkat, keterangan: KETERANGAN_TEMUAN, baris });
}

/** Ubah cakupan tingkat kelas yang dipantau piket (SiteSetting `kedisiplinan.tingkat`).
 * Sengaja LEBIH KETAT dari GET: petugas piket harian boleh membaca, tetapi yang mengubah
 * kebijakan hanya Admin & Wakil Kepala (Penjamin Mutu / Kurikulum). */
export async function PUT(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (session.role !== "ADMIN") {
    try {
      await assertJabatan(session, ["Wakil Kepala Bidang Penjamin Mutu", "Wakil Kepala Kurikulum"]);
    } catch (e) {
      lemparBilaPengalihan(e);
      return Response.json({ error: "Hanya Admin & Wakil Kepala yang boleh mengubah cakupan" }, { status: 403 });
    }
  }
  const b = await req.json().catch(() => ({}));
  const tingkat = Array.isArray(b.tingkat)
    ? [...new Set(b.tingkat.map(Number).filter((v: number) => v === 10 || v === 11 || v === 12))].sort()
    : [];
  if (tingkat.length === 0) return Response.json({ error: "Pilih minimal satu tingkat" }, { status: 400 });
  const nilai = tingkat.join(",");
  await prisma.siteSetting.upsert({
    where: { key: "kedisiplinan.tingkat" },
    create: { key: "kedisiplinan.tingkat", value: nilai },
    update: { value: nilai },
  });
  await logActivity(session, { action: "UPDATE", entity: "SiteSetting", description: `Cakupan tingkat kedisiplinan → ${nilai}` }).catch(() => {});
  return Response.json({ ok: true, tingkat });
}
