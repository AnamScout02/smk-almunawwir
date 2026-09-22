import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/dal";
import { hakPengumuman, penerimaPengumuman, rapikanSasaran } from "@/lib/pengumuman";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

/** KELOLA PENGUMUMAN — Admin/TU & pimpinan: semua; wali kelas: pengumuman buatannya untuk kelas walinya. */
export async function GET() {
  const session = await verifySession();
  const hak = await hakPengumuman(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak membuat pengumuman." }, { status: 403 });
  const [daftar, kelas, jurusan, jabatan] = await Promise.all([
    prisma.announcement.findMany({
      where: hak.semua ? {} : { pembuatId: session.userId },
      orderBy: { createdAt: "desc" }, take: 300,
      include: { _count: { select: { dibaca: true } } },
    }),
    hak.semua ? prisma.class.findMany({ select: { id: true, name: true }, orderBy: [{ grade: "asc" }, { name: "asc" }] }) : Promise.resolve(hak.waliKelas),
    hak.semua ? prisma.major.findMany({ select: { id: true, name: true, code: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
    hak.semua ? prisma.jabatan.findMany({ select: { name: true }, orderBy: { name: "asc" } }) : Promise.resolve([]),
  ]);
  return Response.json({
    semua: hak.semua,
    kelas, jurusan: jurusan.map(j => ({ id: j.id, name: `${j.code} — ${j.name}` })), jabatan: jabatan.map(j => j.name),
    daftar: daftar.map(({ _count, ...a }) => ({ ...a, jumlahDibaca: _count.dibaca, milikSaya: a.pembuatId === session.userId })),
  });
}

export async function POST(req: Request) {
  const session = await verifySession();
  const hak = await hakPengumuman(session);
  if (!hak.boleh) return Response.json({ error: "Tidak berhak membuat pengumuman." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const title = String(b.title ?? "").trim().slice(0, 200);
  const content = String(b.content ?? "").trim().slice(0, 5000);
  if (!title || !content) return Response.json({ error: "Judul dan isi pengumuman wajib diisi." }, { status: 400 });
  const r = rapikanSasaran(b, hak);
  if (r.galat !== undefined) return Response.json({ error: r.galat }, { status: 400 });
  const a = await prisma.announcement.create({
    data: {
      title, content, ...r.sasaran,
      priority: b.priority === "URGENT" ? "URGENT" : "NORMAL",
      active: b.active !== false,
      startDate: b.startDate ? new Date(b.startDate) : new Date(),
      endDate: b.endDate ? new Date(b.endDate) : null,
      wajibKonfirmasi: !!b.wajibKonfirmasi,
      pembuatId: session.userId, pembuatNama: session.name,
    },
  });
  await logActivity(session, { action: "CREATE", entity: "Pengumuman", entityId: a.id, description: `Membuat pengumuman "${title}"` }).catch(() => null);
  // Pengumuman yang langsung berlaku dikirim ke kotak notifikasi sasaran (sekali per pengumuman).
  if (a.active && a.startDate <= new Date() && b.kirimNotifikasi !== false) {
    kirimLatar(async () => {
      const penerima = await penerimaPengumuman(a);
      await kirimNotifikasi({
        userIds: penerima.map(p => p.userId), jenis: "PENGUMUMAN", kunci: `pengumuman:${a.id}`,
        judul: a.priority === "URGENT" ? `Penting: ${a.title}` : a.title,
        isi: a.content.length > 140 ? `${a.content.slice(0, 137)}…` : a.content,
        url: "/pengumuman", tag: `pengumuman-${a.id}`,
      });
    });
  }
  return Response.json(a, { status: 201 });
}
