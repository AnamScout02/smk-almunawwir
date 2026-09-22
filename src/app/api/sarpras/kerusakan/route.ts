import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, FILTER_KERUSAKAN_LAB, lingkupDari, penerimaPengelola } from "@/lib/sarpras-akses";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { segarkanAntrean } from "@/lib/antrean-kerja";

export const dynamic = "force-dynamic";

/** LAPOR KERUSAKAN — semua guru & staf. GET ?semua=1 untuk pengelola (Kepala Lab: lingkup lab), selain itu laporan milik sendiri. */
export async function GET(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const semua = new URL(req.url).searchParams.get("semua") === "1" && a.kelola;
  const daftar = await prisma.assetDamageReport.findMany({
    where: semua ? (a.penuh ? {} : FILTER_KERUSAKAN_LAB) : { pelaporId: session.userId },
    orderBy: { reportDate: "desc" }, take: 300,
    include: { asset: { select: { id: true, name: true, category: true, location: true } } },
  });
  return Response.json({ akses: a, daftar });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!checkRateLimit(`lapor-kerusakan:${session.userId}`, 20, 3600_000)) return Response.json({ error: "Terlalu banyak laporan dalam satu jam." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const description = String(b.description ?? "").trim().slice(0, 2000);
  const judul = String(b.judul ?? "").trim().slice(0, 150);
  const lokasi = String(b.lokasi ?? "").trim().slice(0, 150);
  const fotoUrl = typeof b.fotoUrl === "string" && b.fotoUrl.startsWith("/uploads/sarpras/") ? b.fotoUrl : null;
  const prioritas = ["RENDAH", "SEDANG", "TINGGI"].includes(b.prioritas) ? b.prioritas : "SEDANG";
  const asset = b.assetId ? await prisma.asset.findUnique({ where: { id: String(b.assetId) }, select: { id: true, name: true, category: true, location: true } }) : null;
  if (!asset && !judul) return Response.json({ error: "Tulis barang/fasilitas yang rusak." }, { status: 400 });
  if (!asset && !lokasi) return Response.json({ error: "Tulis lokasinya (ruang/gedung)." }, { status: 400 });
  if (description.length < 5) return Response.json({ error: "Jelaskan kerusakannya." }, { status: 400 });
  const r = await prisma.assetDamageReport.create({
    data: { assetId: asset?.id ?? null, judul: judul || null, lokasi: lokasi || asset?.location || null, fotoUrl, prioritas, description, reportedBy: session.name, pelaporId: session.userId },
  });
  const lingkup = lingkupDari({ asset, lokasi });
  kirimLatar(async () => {
    const ke = await penerimaPengelola(lingkup);
    await kirimNotifikasi({
      userIds: ke, jenis: "SARPRAS", kunci: `kerusakan:${r.id}`,
      judul: `${prioritas === "TINGGI" ? "Mendesak — " : ""}Laporan kerusakan: ${asset?.name ?? judul}`,
      isi: `${r.lokasi ?? ""}${r.lokasi ? " · " : ""}${description.slice(0, 100)} — ${session.name}`,
      url: lingkup === "LAB" ? "/dashboard/teacher/lab" : "/dashboard/teacher/wakasek/sarpras/inventaris", tag: `kerusakan-${r.id}`,
    });
  });
  segarkanAntrean();
  return Response.json({ ok: true }, { status: 201 });
}
