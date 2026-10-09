import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPkl } from "@/lib/pkl-humas";

export const dynamic = "force-dynamic";

/** Jarak garis lurus dua titik (meter, haversine) — salinan di src/lib/pkl-harian.ts dipakai presensi siswa. */
function jarakM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const r = (d: number) => (d * Math.PI) / 180, R = 6371000;
  const a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Catatan monitoring pembimbing sekolah (kunjungan/telepon/daring) + ringkasan penilaian industri. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  const pkl = await aksesPkl(session, id);
  if (!pkl) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const monitoring = await prisma.monitoringPkl.findMany({ where: { internshipId: id }, orderBy: { tanggal: "desc" } });
  return Response.json({
    monitoring,
    penilaian: { nilai: pkl.nilaiIndustri, rata: pkl.nilaiIndustriRata, penilai: pkl.penilaiIndustri, catatan: pkl.catatanIndustri, pada: pkl.nilaiIndustriPada, tautanAktif: !!pkl.tokenPenilaianSampai && pkl.tokenPenilaianSampai > new Date(), tautanSampai: pkl.tokenPenilaianSampai },
    sertifikat: { nomor: pkl.sertifikatNomor, pada: pkl.sertifikatPada },
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  if (!(await aksesPkl(session, id))) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const tanggal = new Date(b.tanggal);
  const catatan = String(b.catatan ?? "").trim().slice(0, 3000);
  if (isNaN(tanggal.getTime())) return Response.json({ error: "Tanggal tidak valid." }, { status: 400 });
  if (catatan.length < 5) return Response.json({ error: "Tulis hasil monitoring." }, { status: 400 });
  const cara = ["KUNJUNGAN", "TELEPON", "DARING"].includes(b.cara) ? b.cara : "KUNJUNGAN";
  // "Saya di lokasi": lokasi HP guru hanya bermakna untuk KUNJUNGAN. Jarak ke titik DUDI dihitung SERVER dari titik
  // yang tersimpan di Data DUDI — browser hanya mengirim koordinatnya sendiri.
  const lokasiSah = cara === "KUNJUNGAN" && typeof b.lat === "number" && typeof b.lng === "number" && Math.abs(b.lat) <= 90 && Math.abs(b.lng) <= 180;
  let jarakMeter: number | null = null;
  if (lokasiSah) {
    const m = await prisma.internship.findUnique({ where: { id }, select: { mitra: { select: { lat: true, lng: true } } } });
    if (m?.mitra?.lat != null && m.mitra.lng != null) jarakMeter = Math.round(jarakM(b.lat, b.lng, m.mitra.lat, m.mitra.lng));
  }
  await prisma.monitoringPkl.create({
    data: {
      internshipId: id, tanggal, catatan, olehNama: session.name, cara,
      // Unggahan disajikan dari /api/uploads/… — dulu hanya "/uploads/" yang diterima sehingga foto kunjungan tidak pernah tersimpan.
      fotoUrl: typeof b.fotoUrl === "string" && /^\/(api\/)?uploads\/pkl-jurnal\//.test(b.fotoUrl) ? b.fotoUrl : null,
      lat: lokasiSah ? b.lat : null, lng: lokasiSah ? b.lng : null,
      akurasi: lokasiSah && typeof b.akurasi === "number" ? Math.round(b.akurasi) : null, jarakMeter,
    },
  });
  return Response.json({ ok: true }, { status: 201 });
}
