import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { checkRateLimit } from "@/lib/rate-limit";
import { JABATAN_BRANDING } from "@/lib/branding-guard";

export const dynamic = "force-dynamic";

/** PENGAJUAN LIPUTAN — semua guru/staf mengirim cerita & foto kegiatan; Tim Branding menyunting & menerbitkan. */
async function timBranding(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  return (await getJabatanNames(s.email)).includes(JABATAN_BRANDING);
}

export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const tim = await timBranding(session);
  const daftar = await prisma.usulanLiputan.findMany({
    where: tim ? {} : { pengusulId: session.userId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 200,
  });
  return Response.json({ tim, daftar });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!checkRateLimit(`liputan:${session.userId}`, 10, 86400_000)) return Response.json({ error: "Batas 10 pengajuan per hari." }, { status: 429 });
  const b = await req.json().catch(() => ({}));
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const isi = String(b.isi ?? "").trim().slice(0, 5000);
  if (judul.length < 4 || isi.length < 20) return Response.json({ error: "Judul dan cerita kegiatan wajib diisi (cerita minimal 20 huruf)." }, { status: 400 });
  const fotoUrls = (Array.isArray(b.fotoUrls) ? b.fotoUrls : []).filter((u: unknown): u is string => typeof u === "string" && u.startsWith("/uploads/")).slice(0, 8);
  const u = await prisma.usulanLiputan.create({
    data: { judul, isi, fotoUrls, tanggalKegiatan: b.tanggalKegiatan ? new Date(b.tanggalKegiatan) : null, pengusulId: session.userId, pengusulNama: session.name },
  });
  kirimLatar(async () => {
    const [guru, staf] = await Promise.all([
      prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: JABATAN_BRANDING } } } }, select: { userId: true } }),
      prisma.user.findMany({ where: { role: "TAS", staffJabatan: { some: { jabatan: { name: JABATAN_BRANDING } } } }, select: { id: true } }),
    ]);
    await kirimNotifikasi({
      userIds: [...guru.map(g => g.userId), ...staf.map(x => x.id)], jenis: "PENGUMUMAN", kunci: `liputan:${u.id}`,
      judul: `Usulan liputan: ${judul}`, isi: `dari ${session.name}${fotoUrls.length ? ` · ${fotoUrls.length} foto` : ""}`,
      url: "/dashboard/teacher/branding/liputan", tag: `liputan-${u.id}`,
    });
  });
  return Response.json({ ok: true }, { status: 201 });
}
