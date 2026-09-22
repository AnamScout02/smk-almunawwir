import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";

export const dynamic = "force-dynamic";

const JENIS = "Home Visit";

async function siswaWali(email: string) {
  const t = await prisma.teacher.findFirst({ where: { user: { email } }, select: { homeroomOf: { select: { id: true } } } });
  return t?.homeroomOf.map(c => c.id) ?? [];
}

/** KUNJUNGAN RUMAH oleh WALI KELAS (17 Sep 2026) — disimpan sebagai Rekam BK jenis "Home Visit" (BK ikut melihat). Wali kelas
 * hanya melihat & menulis kunjungan siswa kelas walinya. ADMIN/TAS melihat SEMUA kelas sebagai
 * pengawasan (19 Sep 2026) — superadmin bukan wali kelas, jadi penyaringan kelas wali dilewati. */
export async function GET() {
  const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const semua = session.role !== "TEACHER";
  const kelas = semua ? [] : await siswaWali(session.email);
  if (!semua && !kelas.length) return Response.json({ error: "Khusus wali kelas." }, { status: 403 });
  const saringKelas = semua ? {} : { classId: { in: kelas } };
  const [siswa, catatan] = await Promise.all([
    prisma.student.findMany({ where: { ...saringKelas, studentStatus: "AKTIF" }, select: { id: true, nis: true, address: true, user: { select: { name: true } }, class: { select: { name: true } } }, orderBy: { user: { name: "asc" } } }),
    prisma.studentCaseNote.findMany({
      where: { handlingType: JENIS, ...(semua ? {} : { student: { classId: { in: kelas } } }) }, orderBy: { date: "desc" }, take: 200,
      select: { id: true, note: true, status: true, date: true, handledByName: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } },
    }),
  ]);
  return Response.json({
    siswa: siswa.map(s => ({ id: s.id, nama: s.user.name, nis: s.nis, kelas: s.class?.name ?? "-", alamat: s.address ?? "" })),
    catatan: catatan.map(c => ({ id: c.id, catatan: c.note, status: c.status, tanggal: c.date, oleh: c.handledByName, siswa: c.student.user.name, kelas: c.student.class?.name ?? "-" })),
  });
}

export async function POST(req: Request) {
  const session = await verifyRole(["TEACHER"]);
  const kelas = await siswaWali(session.email);
  const b = await req.json().catch(() => null) as { studentId?: string; tanggal?: string; catatan?: string; selesai?: boolean } | null;
  const catatan = (b?.catatan ?? "").trim().slice(0, 3000);
  const tanggal = new Date(`${b?.tanggal ?? ""}T00:00:00Z`);
  if (!b?.studentId || catatan.length < 10 || isNaN(tanggal.getTime())) return Response.json({ error: "Pilih siswa, tanggal, dan tulis hasil kunjungan (minimal 10 huruf)." }, { status: 400 });
  const siswa = await prisma.student.findFirst({ where: { id: b.studentId, classId: { in: kelas } }, select: { id: true, user: { select: { name: true } } } });
  if (!siswa) return Response.json({ error: "Siswa bukan dari kelas wali Anda." }, { status: 403 });
  const c = await prisma.studentCaseNote.create({
    data: { studentId: siswa.id, handlingType: JENIS, note: catatan, status: b.selesai ? "SELESAI" : "BERJALAN", date: tanggal, handledByName: session.name, handledByRole: "Wali Kelas" },
  });
  await logActivity(session, { action: "CATAT_KUNJUNGAN_RUMAH", entity: "StudentCaseNote", entityId: c.id, description: `Kunjungan rumah ${siswa.user.name}` }).catch(() => {});
  return Response.json({ ok: true }, { status: 201 });
}
