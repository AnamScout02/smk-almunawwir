import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertPerpustakaan } from "@/lib/perpustakaan-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

async function petugas(s: { role: string; email: string }) {
  try { await assertPerpustakaan(s); return true; } catch (e) { lemparBilaPengalihan(e); return false; }
}

/** USULAN BUKU — anggota mengusulkan & mendukung; petugas melihat semua. Urut: dukungan terbanyak. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  const daftar = await prisma.usulanBuku.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300 });
  return Response.json({
    petugas: await petugas(session),
    daftar: daftar.map(u => ({ ...u, pendukung: undefined, jumlahDukungan: u.pendukung.length + 1, saya: u.pengusulId === session.userId, sayaDukung: u.pendukung.includes(session.userId) }))
      .sort((a, b) => Number(a.status !== "DIUSULKAN") - Number(b.status !== "DIUSULKAN") || b.jumlahDukungan - a.jumlahDukungan),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER", "STUDENT"]);
  if (!checkRateLimit(`usulan-buku:${session.userId}`, 10, 86400_000)) return Response.json({ error: "Batas 10 usulan per hari." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  if (judul.length < 2) return Response.json({ error: "Tulis judul buku." }, { status: 400 });
  const sama = await prisma.usulanBuku.findFirst({ where: { judul: { equals: judul, mode: "insensitive" }, status: "DIUSULKAN" }, select: { id: true } });
  if (sama) return Response.json({ error: "Buku ini sudah diusulkan — dukung usulan yang ada saja." }, { status: 409 });
  const u = await prisma.usulanBuku.create({
    data: {
      judul, penulis: String(b.penulis ?? "").trim().slice(0, 150) || null, penerbit: String(b.penerbit ?? "").trim().slice(0, 150) || null,
      alasan: String(b.alasan ?? "").trim().slice(0, 1000) || null, pengusulId: session.userId, pengusulNama: session.name, peran: session.role,
    },
  });
  kirimLatar(async () => {
    const [guru, staf] = await Promise.all([
      prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: "Koordinator Perpustakaan" } } } }, select: { userId: true } }),
      prisma.user.findMany({ where: { role: "TAS", staffJabatan: { some: { jabatan: { name: "Koordinator Perpustakaan" } } } }, select: { id: true } }),
    ]);
    await kirimNotifikasi({ userIds: [...guru.map(g => g.userId), ...staf.map(x => x.id)], jenis: "PERPUS_RESERVASI", kunci: `usulan-buku:${u.id}`, judul: `Usulan buku: ${judul}`, isi: `dari ${session.name}`, url: "/pusat-perpustakaan/usulan", tag: `usulan-${u.id}` });
  });
  return Response.json({ ok: true }, { status: 201 });
}
