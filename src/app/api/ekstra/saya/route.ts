import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { daftarEkstra, ekstraSiswa } from "@/lib/ekstra-siswa";

export const dynamic = "force-dynamic";

/** Ekskul milik SISWA yang sedang masuk, atau anak dari ORANG TUA yang sedang masuk (`?anak=` hanya dipilih dari
 *  anak yang sah milik akun itu — tidak pernah dipercaya mentah). Orang tua hanya membaca. */
export async function GET(req: Request) {
  const session = await verifyRole(["STUDENT", "PARENT"]);
  if (session.role === "PARENT") {
    const anak = resolveSelectedChild(await getParentChildrenOrRedirect(session), new URL(req.url).searchParams.get("anak") ?? undefined);
    return Response.json({ peran: "PARENT", ...(await ekstraSiswa(anak.id, { denganTersedia: false })) });
  }
  const s = await prisma.student.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!s) return Response.json({ error: "Data siswa tidak ditemukan." }, { status: 404 });
  return Response.json({ peran: "STUDENT", ...(await ekstraSiswa(s.id, { denganTersedia: true })) });
}

/** Siswa mendaftar ke satu ekskul. */
export async function POST(req: Request) {
  const session = await verifyRole(["STUDENT"]);
  const s = await prisma.student.findUnique({ where: { userId: session.userId }, select: { id: true } });
  if (!s) return Response.json({ error: "Data siswa tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { extracurricularId?: unknown; alasan?: unknown };
  const alasan = typeof b.alasan === "string" ? b.alasan.trim().slice(0, 300) || null : null;
  const h = await daftarEkstra(s.id, String(b.extracurricularId ?? ""), alasan);
  if ("galat" in h) return Response.json({ error: h.galat }, { status: h.kode });
  return Response.json({ ok: true }, { status: 201 });
}

/** Siswa membatalkan pendaftarannya yang masih menunggu. */
export async function DELETE(req: Request) {
  const session = await verifyRole(["STUDENT"]);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const n = await prisma.pendaftaranEkstra.deleteMany({ where: { id, status: "MENUNGGU", student: { userId: session.userId } } });
  if (!n.count) return Response.json({ error: "Pendaftaran tidak ditemukan atau sudah diputuskan." }, { status: 404 });
  return Response.json({ ok: true });
}
