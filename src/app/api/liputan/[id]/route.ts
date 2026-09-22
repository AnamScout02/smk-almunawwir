import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getJabatanNames } from "@/lib/jabatan-guard";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { JABATAN_BRANDING } from "@/lib/branding-guard";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = { BARU: "menunggu", DIPROSES: "sedang disunting", DITERBITKAN: "diterbitkan", DITOLAK: "belum bisa diterbitkan" };

async function tim(s: { role: string; email: string }) {
  if (s.role === "ADMIN") return true;
  if (s.role !== "TEACHER" && s.role !== "TAS") return false;
  return (await getJabatanNames(s.email)).includes(JABATAN_BRANDING);
}

/** Tim Branding: ubah status / buat draf berita dari usulan (aksi "draf"). Pengusul: hapus usulannya yang masih BARU. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await tim(session))) return Response.json({ error: "Khusus Tim Branding & Publikasi." }, { status: 403 });
  const { id } = await params;
  const u = await prisma.usulanLiputan.findUnique({ where: { id } });
  if (!u) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({}));

  if (b.aksi === "draf") {
    const slug = `${u.judul.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70)}-${randomBytes(3).toString("hex")}`;
    const isi = [u.isi, u.fotoUrls.length ? `\n\nFoto dari pengusul:\n${u.fotoUrls.join("\n")}` : "", `\n\n[Liputan dari ${u.pengusulNama} — sunting & lengkapi sebelum diterbitkan]`].join("");
    const n = await prisma.news.create({ data: { title: u.judul, slug, content: isi, category: "Kegiatan", published: false, thumbnail: u.fotoUrls[0] ?? null } });
    await prisma.usulanLiputan.update({ where: { id }, data: { status: "DIPROSES", newsId: n.id } });
    return Response.json({ ok: true, newsId: n.id });
  }

  const status = STATUS[String(b.status ?? "")] ? String(b.status) : null;
  if (!status) return Response.json({ error: "Status tidak dikenal." }, { status: 400 });
  const tanggapan = String(b.tanggapan ?? "").trim().slice(0, 500) || null;
  await prisma.usulanLiputan.update({ where: { id }, data: { status, tanggapan } });
  if (status !== u.status) {
    kirimLatar(() => kirimNotifikasi({
      userIds: [u.pengusulId], jenis: "PENGUMUMAN", kunci: `liputan-status:${id}:${status}`,
      judul: `Usulan liputan "${u.judul}" ${STATUS[status]}`, isi: tanggapan ?? "Terima kasih atas kirimannya.", url: "/dashboard/teacher/liputan", tag: `liputan-${id}`,
    }));
  }
  return Response.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const { id } = await params;
  const u = await prisma.usulanLiputan.findUnique({ where: { id } });
  if (!u) return Response.json({ ok: true });
  if (!(await tim(session)) && !(u.pengusulId === session.userId && u.status === "BARU")) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.usulanLiputan.delete({ where: { id } });
  return Response.json({ ok: true });
}
