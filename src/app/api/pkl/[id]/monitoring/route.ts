import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesPkl } from "@/lib/pkl-humas";

export const dynamic = "force-dynamic";

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
  await prisma.monitoringPkl.create({
    data: {
      internshipId: id, tanggal, catatan, olehNama: session.name,
      cara: ["KUNJUNGAN", "TELEPON", "DARING"].includes(b.cara) ? b.cara : "KUNJUNGAN",
      fotoUrl: typeof b.fotoUrl === "string" && b.fotoUrl.startsWith("/uploads/") ? b.fotoUrl : null,
    },
  });
  return Response.json({ ok: true }, { status: 201 });
}
