import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { NextRequest } from "next/server";
import { semesterRapor as generateSemesters } from "@/lib/rapor-verifikasi";
import { logActivity } from "@/lib/activity-log";
import { segarkanAntrean } from "@/lib/antrean-kerja";

async function assertKepsekOrAdmin(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return;
  const teacher = await prisma.teacher.findFirst({
    where: { user: { email: session.email } },
    select: { jabatan: { select: { jabatan: { select: { name: true } } } } },
  });
  const isKepsek = teacher?.jabatan.some(j => j.jabatan.name === "Kepala Sekolah") ?? false;
  if (!isKepsek) throw new Error("FORBIDDEN");
}

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertKepsekOrAdmin(session);

    const semesters = generateSemesters();
    const [classes, approvals, kunci] = await Promise.all([
      prisma.class.findMany({
        select: { id: true, name: true, grade: true, homeroom: { select: { user: { select: { name: true } } } } },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
      }),
      prisma.raporApproval.findMany(),
      prisma.raporKunci.findMany(),
    ]);
    const approvalMap = new Map(approvals.map(a => [`${a.classId}::${a.semester}`, a]));
    const kunciMap = new Map(kunci.map(k => [`${k.classId}::${k.semester}`, k]));

    const rows = classes.flatMap(cls => semesters.map(semester => {
      const approval = approvalMap.get(`${cls.id}::${semester}`);
      const k = kunciMap.get(`${cls.id}::${semester}`);
      return {
        classId: cls.id, className: cls.name, grade: cls.grade, semester,
        waliKelas: cls.homeroom?.user.name ?? null,
        locked: !!k, lockedBy: k?.lockedBy ?? null, lockedAt: k?.lockedAt ?? null,
        approved: !!approval, approvalId: approval?.id ?? null,
        approvedBy: approval?.approvedBy ?? null, approvedAt: approval?.approvedAt ?? null,
      };
    }));

    return Response.json(rows);
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN"]);
    await assertKepsekOrAdmin(session);

    const body = await req.json() as { classId?: string; classIds?: string[]; semester?: string; note?: string };
    const { semester, note } = body;
    // Satu kelas (classId) atau banyak sekaligus (classIds — tombol "Sahkan Semua yang Siap", permintaan user 17 Sep 2026).
    const daftar = [...new Set(Array.isArray(body.classIds) ? body.classIds.filter(x => typeof x === "string") : body.classId ? [body.classId] : [])];
    if (!daftar.length || !semester) {
      return Response.json({ error: "Kelas dan semester wajib diisi." }, { status: 400 });
    }

    // Verifikasi bertingkat (17 Sep 2026): pengesahan hanya setelah wali kelas mengunci nilai.
    const kunci = await prisma.raporKunci.findMany({ where: { classId: { in: daftar }, semester }, select: { classId: true } });
    const siap = daftar.filter(id => kunci.some(k => k.classId === id));
    if (!siap.length) {
      return Response.json({ error: "Wali kelas belum mengunci nilai kelas ini untuk semester tersebut." }, { status: 409 });
    }

    const approvals = await prisma.$transaction(siap.map(classId => prisma.raporApproval.upsert({
      where: { classId_semester: { classId, semester } },
      create: { classId, semester, approvedBy: session.name, note: note || null },
      update: { approvedBy: session.name, approvedAt: new Date(), note: note || null },
    })));

    const kelas = await prisma.class.findMany({ where: { id: { in: siap } }, select: { name: true }, orderBy: { name: "asc" } });
    await logActivity(session, {
      action: "SAHKAN_RAPOR", entity: "RaporApproval", entityId: siap.length === 1 ? approvals[0].id : semester,
      description: `Mengesahkan rapor semester ${semester}: ${kelas.map(k => k.name).join(", ")}`,
    }).catch(() => {});
    segarkanAntrean();
    return Response.json(siap.length === 1 && body.classId ? approvals[0] : { disahkan: siap.length, dilewati: daftar.length - siap.length });
  } catch (e) {
    if (e instanceof Error && e.message === "FORBIDDEN") {
      return Response.json({ error: "Khusus Kepala Sekolah." }, { status: 403 });
    }
    return Response.json({ error: "Gagal menyimpan pengesahan." }, { status: 500 });
  }
}
