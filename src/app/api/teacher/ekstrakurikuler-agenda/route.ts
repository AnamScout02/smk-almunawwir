import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { getOwnedExtracurricularNames } from "@/lib/ekstrakurikuler-guard";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

const JENIS = ["LATIHAN", "LOMBA", "PENTAS", "RAPAT"];

async function ekskulSaya(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return prisma.extracurricular.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const nama = await getOwnedExtracurricularNames(session.email);
  return nama.length ? prisma.extracurricular.findMany({ where: { name: { in: nama } }, select: { id: true, name: true }, orderBy: { name: "asc" } }) : [];
}

/** JADWAL LATIHAN & LOMBA per ekstrakurikuler. */
export async function GET() {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const ekskul = await ekskulSaya(session);
  if (!ekskul.length) return Response.json({ error: "Anda belum menjadi pembina ekstrakurikuler." }, { status: 403 });
  const agenda = await prisma.agendaEkstra.findMany({ where: { extracurricularId: { in: ekskul.map(e => e.id) } }, orderBy: { mulai: "desc" }, take: 200 });
  return Response.json({ ekskul, agenda });
}

export async function POST(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const ekskul = await ekskulSaya(session);
  const b = await req.json().catch(() => ({}));
  const e = ekskul.find(x => x.id === b.extracurricularId);
  if (!e) return Response.json({ error: "Ekstrakurikuler ini bukan binaan Anda." }, { status: 403 });
  const judul = String(b.judul ?? "").trim().slice(0, 200);
  const mulai = new Date(b.mulai);
  if (!judul || isNaN(mulai.getTime())) return Response.json({ error: "Judul dan waktu mulai wajib diisi." }, { status: 400 });
  const a = await prisma.agendaEkstra.create({
    data: {
      extracurricularId: e.id, judul, jenis: JENIS.includes(b.jenis) ? b.jenis : "LATIHAN", mulai,
      selesai: b.selesai ? new Date(b.selesai) : null, tempat: String(b.tempat ?? "").trim().slice(0, 150) || null,
      catatan: String(b.catatan ?? "").trim().slice(0, 1000) || null, hasil: String(b.hasil ?? "").trim().slice(0, 300) || null,
      olehNama: session.name,
    },
  });
  if (b.kabari) {
    kirimLatar(async () => {
      const anggota = await prisma.extracurricularMember.findMany({ where: { extracurricularId: e.id, student: { studentStatus: "AKTIF" } }, select: { student: { select: { userId: true } } } });
      await kirimNotifikasi({
        userIds: anggota.map(x => x.student.userId), jenis: "PENGUMUMAN", kunci: `agenda-ekstra:${a.id}`,
        judul: `${e.name}: ${judul}`,
        isi: `${mulai.toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB${a.tempat ? ` · ${a.tempat}` : ""}`,
        url: "/dashboard/student", tag: `ekstra-${a.id}`,
      });
    });
  }
  return Response.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
  const ekskul = await ekskulSaya(session);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const a = await prisma.agendaEkstra.findUnique({ where: { id }, select: { extracurricularId: true } });
  if (!a || !ekskul.some(e => e.id === a.extracurricularId)) return Response.json({ error: "Tidak berhak." }, { status: 403 });
  await prisma.agendaEkstra.delete({ where: { id } });
  return Response.json({ ok: true });
}
