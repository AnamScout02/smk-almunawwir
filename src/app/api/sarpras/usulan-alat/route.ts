import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesSarpras, penerimaPengelola, teksLab } from "@/lib/sarpras-akses";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** USULAN ALAT & BAHAN PRAKTIK — semua guru (khususnya Kaprogli & Kepala Lab) mengusulkan; pengelola Sarpras menindaklanjuti. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const a = await aksesSarpras(session);
  const daftar = await prisma.usulanAlat.findMany({
    where: a.kelola ? (a.penuh ? {} : { lingkup: "LAB" }) : { pengusulId: session.userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
  });
  const jurusan = await prisma.major.findMany({ select: { id: true, code: true, name: true }, orderBy: { name: "asc" } });
  return Response.json({ kelola: a.kelola, jurusan, daftar });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!checkRateLimit(`usulan-alat:${session.userId}`, 30, 86400_000)) return Response.json({ error: "Batas 30 usulan per hari." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const nama = String(b.nama ?? "").trim().slice(0, 200);
  const alasan = String(b.alasan ?? "").trim().slice(0, 1000);
  if (nama.length < 2 || alasan.length < 5) return Response.json({ error: "Nama alat/bahan dan alasan wajib diisi." }, { status: 400 });
  const lingkup = teksLab(String(b.lingkup ?? ""), nama) || b.lingkup === "LAB" ? "LAB" : "SARPRAS";
  const u = await prisma.usulanAlat.create({
    data: {
      nama, alasan, jumlah: Math.max(1, Math.round(Number(b.jumlah) || 1)), satuan: String(b.satuan ?? "unit").trim().slice(0, 20) || "unit",
      perkiraanHarga: Number.isFinite(Number(b.perkiraanHarga)) && Number(b.perkiraanHarga) > 0 ? Math.round(Number(b.perkiraanHarga)) : null,
      majorId: typeof b.majorId === "string" && b.majorId ? b.majorId : null, lingkup,
      pengusulId: session.userId, pengusulNama: session.name,
    },
  });
  kirimLatar(async () => kirimNotifikasi({
    userIds: await penerimaPengelola(lingkup), jenis: "SARPRAS", kunci: `usulan-alat:${u.id}`,
    judul: `Usulan alat/bahan: ${nama}`, isi: `${u.jumlah} ${u.satuan} — ${session.name}`,
    url: lingkup === "LAB" ? "/dashboard/teacher/lab/usulan-alat" : "/dashboard/teacher/wakasek/sarpras/usulan-alat", tag: `usulan-alat-${u.id}`,
  }));
  return Response.json({ ok: true }, { status: 201 });
}
