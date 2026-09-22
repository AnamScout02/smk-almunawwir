import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { petugasTu } from "@/lib/tas-access-guard";
import { checkRateLimit } from "@/lib/rate-limit";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const KATEGORI: Record<string, string> = { SANDI: "Lupa/ganti sandi", AKUN: "Masalah akun & login", DATA: "Data tidak sesuai", APLIKASI: "Aplikasi bermasalah", LAINNYA: "Lainnya" };

/** PUSAT BANTUAN — semua pengguna mengirim tiket; staf TU & Admin menanganinya. */
export async function GET() {
  const session = await verifySession();
  const petugas = await petugasTu();
  const daftar = await prisma.tiketBantuan.findMany({
    where: petugas ? {} : { pengirimId: session.userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 300,
  });
  return Response.json({ petugas, kategori: KATEGORI, daftar });
}

export async function POST(req: Request) {
  const session = await verifySession();
  if (!checkRateLimit(`bantuan:${session.userId}`, 10, 86400_000)) return Response.json({ error: "Batas 10 tiket per hari." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const isi = String(b.isi ?? "").trim().slice(0, 2000);
  if (isi.length < 10) return Response.json({ error: "Ceritakan kendalanya minimal 10 huruf." }, { status: 400 });
  const t = await prisma.tiketBantuan.create({
    data: {
      pengirimId: session.userId, pengirimNama: session.name, peran: session.role,
      kontak: String(b.kontak ?? "").trim().slice(0, 100) || null,
      kategori: KATEGORI[String(b.kategori)] ? String(b.kategori) : "LAINNYA", isi,
    },
  });
  kirimLatar(async () => {
    const [guru, staf, admin] = await Promise.all([
      prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: { in: ["Tenaga Administrasi Sekolah", "Kepala Tenaga Administrasi Sekolah", "Operator Sekolah"] } } } } }, select: { userId: true } }),
      prisma.user.findMany({ where: { role: "TAS", staffJabatan: { some: { jabatan: { name: { in: ["Tenaga Administrasi Sekolah", "Kepala Tenaga Administrasi Sekolah"] } } } } }, select: { id: true } }),
      prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } }),
    ]);
    await kirimNotifikasi({
      userIds: [...guru.map(g => g.userId), ...staf.map(x => x.id), ...admin.map(x => x.id)], jenis: "PENGUMUMAN", kunci: `bantuan:${t.id}`,
      judul: `Bantuan: ${KATEGORI[t.kategori]}`, isi: `${session.name} — ${isi.slice(0, 100)}`, url: "/dashboard/admin/bantuan", tag: `bantuan-${t.id}`,
    });
  });
  return Response.json({ ok: true }, { status: 201 });
}
