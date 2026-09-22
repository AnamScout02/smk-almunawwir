import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { dataCatatanWali } from "@/lib/catatan-wali";
import { semesterRapor } from "@/lib/rapor-verifikasi";

export const dynamic = "force-dynamic";

async function bolehKelas(session: { role: string; email: string }, classId: string) {
  if (session.role === "ADMIN") return true;
  const t = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } });
  return !!t?.homeroomOf.some(c => c.id === classId);
}

/** CATATAN WALI KELAS (rapor). GET `?classId&semester` → data + saran otomatis. PUT → simpan (wali kelas/Admin; ditolak bila rapor sudah disahkan). */
export async function GET(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const u = new URL(req.url);
  const classId = u.searchParams.get("classId") ?? "", semester = u.searchParams.get("semester") ?? "";
  if (!semesterRapor().includes(semester) || !(await bolehKelas(session, classId))) return Response.json({ error: "Khusus wali kelas." }, { status: 403 });
  const data = await dataCatatanWali(classId, semester);
  if (!data) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  const sah = await prisma.raporApproval.findUnique({ where: { classId_semester: { classId, semester } }, select: { id: true } });
  return Response.json({ ...data, disahkan: !!sah });
}

export async function PUT(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const b = await req.json().catch(() => null) as { classId?: string; semester?: string; catatan?: { studentId: string; teks: string }[] } | null;
  const classId = b?.classId ?? "", semester = b?.semester ?? "";
  if (!semesterRapor().includes(semester) || !(await bolehKelas(session, classId))) return Response.json({ error: "Khusus wali kelas." }, { status: 403 });
  const sah = await prisma.raporApproval.findUnique({ where: { classId_semester: { classId, semester } }, select: { id: true } });
  if (sah) return Response.json({ error: "Rapor semester ini sudah disahkan — catatan tidak bisa diubah." }, { status: 409 });
  const siswa = new Set((await prisma.student.findMany({ where: { classId }, select: { id: true } })).map(s => s.id));
  const daftar = (Array.isArray(b?.catatan) ? b!.catatan : []).filter(c => siswa.has(c.studentId) && typeof c.teks === "string");
  await prisma.$transaction(daftar.map(c => {
    const teks = c.teks.trim().slice(0, 1000);
    return teks
      ? prisma.catatanWaliKelas.upsert({
          where: { studentId_semester: { studentId: c.studentId, semester } },
          create: { studentId: c.studentId, semester, catatan: teks, dibuatOleh: session.name },
          update: { catatan: teks, dibuatOleh: session.name },
        })
      : prisma.catatanWaliKelas.deleteMany({ where: { studentId: c.studentId, semester } });
  }));
  return Response.json({ ok: true, disimpan: daftar.length });
}
