import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { aksesHumas } from "@/lib/pkl-humas";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** Kerja sama baru → DRAF berita (belum terbit) untuk disunting & diterbitkan Tim Branding. */
export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  if (!(await aksesHumas(session))) return Response.json({ error: "Khusus Wakil Kepala Humas." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const m = await prisma.industryPartner.findUnique({ where: { id: String(b.partnerId ?? "") } });
  if (!m) return Response.json({ error: "Mitra tidak ditemukan." }, { status: 404 });
  const judul = `SMK Al-Munawwir IIBS Jalin Kerja Sama dengan ${m.name}`;
  const slug = `${judul.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 70)}-${randomBytes(3).toString("hex")}`;
  const periode = m.mouStartDate && m.mouEndDate
    ? ` Kerja sama berlaku ${m.mouStartDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })} sampai ${m.mouEndDate.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}.`
    : "";
  const isi = [
    `SMK Al-Munawwir IIBS resmi menjalin kerja sama dengan ${m.name}${m.industryField ? `, perusahaan yang bergerak di bidang ${m.industryField}` : ""}.${periode}`,
    `Melalui kerja sama ini, siswa berkesempatan melaksanakan Praktik Kerja Lapangan (PKL)${m.quota ? ` dengan kuota ${m.quota} siswa` : ""}, sekaligus memperkuat keselarasan kurikulum sekolah dengan kebutuhan dunia usaha dan dunia industri.`,
    `[Tim Branding: lengkapi kutipan dari Kepala Sekolah dan pihak ${m.name}, foto penandatanganan, serta rencana program bersama sebelum diterbitkan.]`,
  ].join("\n\n");
  const n = await prisma.news.create({ data: { title: judul, slug, content: isi, category: "Kerja Sama", published: false } });
  await logActivity(session, { action: "CREATE", entity: "News", entityId: n.id, description: `Membuat draf berita kerja sama ${m.name}` }).catch(() => null);
  kirimLatar(async () => {
    const guru = await prisma.teacher.findMany({ where: { jabatan: { some: { jabatan: { name: "Koordinator Tim Branding & Publikasi" } } } }, select: { userId: true } });
    await kirimNotifikasi({
      userIds: guru.map(g => g.userId), jenis: "PENGUMUMAN", kunci: `draf-berita-kerja-sama:${n.id}`,
      judul: "Draf berita kerja sama menunggu disunting", isi: `${m.name} — dari ${session.name}`, url: "/dashboard/teacher/branding/news", tag: `berita-${n.id}`,
    });
  });
  return Response.json({ ok: true, id: n.id }, { status: 201 });
}
