import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { logActivity } from "@/lib/activity-log";
import { segarkanAntrean } from "@/lib/antrean-kerja";
import { semesterRapor } from "@/lib/rapor-verifikasi";

export const dynamic = "force-dynamic";

/** KUNCI NILAI RAPOR oleh WALI KELAS (tahap 1 verifikasi bertingkat, 17 Sep 2026). Wali kelas hanya untuk kelas walinya; Admin
 * boleh semua kelas. GET = status & kemajuan nilai per mapel; POST = kunci; DELETE = buka kunci (hanya bila belum disahkan). */

async function kelasBoleh(session: { role: string; email: string }) {
  if (session.role === "ADMIN") return null; // semua kelas
  const t = await prisma.teacher.findFirst({ where: { user: { email: session.email } }, select: { homeroomOf: { select: { id: true } } } });
  return t?.homeroomOf.map(c => c.id) ?? [];
}

export async function GET() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const boleh = await kelasBoleh(session);
  const semesters = semesterRapor();
  const kelas = await prisma.class.findMany({
    where: boleh ? { id: { in: boleh } } : undefined,
    select: {
      id: true, name: true, grade: true,
      students: { where: { studentStatus: "AKTIF" }, select: { id: true } },
      teachingAssignments: { select: { subject: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } } },
      raporKunci: { where: { semester: { in: semesters } } },
      raporApprovals: { where: { semester: { in: semesters } } },
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  });
  if (!kelas.length) return Response.json({ kelas: [], semesters });

  // Kemajuan penilaian: berapa siswa aktif yang sudah punya nilai jurnal per mapel per semester.
  const entri = await prisma.journalEntry.findMany({
    where: {
      studentId: { in: kelas.flatMap(k => k.students.map(s => s.id)) },
      journal: { classId: { in: kelas.map(k => k.id) }, semester: { in: semesters } },
      OR: [{ scorePengetahuan: { not: null } }, { scoreKeterampilan: { not: null } }],
    },
    select: { studentId: true, journal: { select: { classId: true, subject: true, semester: true } } },
  });
  // Status Form Nilai Rapor per mapel (DRAF/DIKIRIM) — sumber nilai rapor cetak format makro sekolah.
  const forms = await prisma.formNilaiRapor.findMany({
    where: { classId: { in: kelas.map(k => k.id) }, semester: { in: semesters } },
    select: { classId: true, semester: true, subject: true, status: true, katrol: true, dikirimAt: true },
  });
  const petaForm = new Map(forms.map(f => [`${f.classId}|${f.semester}|${f.subject}`, f]));
  const dinilai = new Map<string, Set<string>>();
  for (const e of entri) {
    const k = `${e.journal.classId}|${e.journal.semester}|${e.journal.subject}`;
    if (!dinilai.has(k)) dinilai.set(k, new Set());
    dinilai.get(k)!.add(e.studentId);
  }

  return Response.json({
    semesters,
    kelas: kelas.map(k => ({
      id: k.id, nama: k.name, jumlahSiswa: k.students.length,
      semester: semesters.map(sem => {
        const kunci = k.raporKunci.find(x => x.semester === sem);
        const sah = k.raporApprovals.find(x => x.semester === sem);
        const mapel = k.teachingAssignments.map(a => ({
          mapel: a.subject.name, guru: a.teacher.user.name,
          dinilai: dinilai.get(`${k.id}|${sem}|${a.subject.name}`)?.size ?? 0,
          form: (() => {
            const f = petaForm.get(`${k.id}|${sem}|${a.subject.name}`);
            return f ? { status: f.status, katrol: f.katrol, dikirimAt: f.dikirimAt } : null;
          })(),
        })).sort((a, b) => a.mapel.localeCompare(b.mapel, "id"));
        return {
          semester: sem,
          dikunci: kunci ? { oleh: kunci.lockedBy, pada: kunci.lockedAt } : null,
          disahkan: sah ? { oleh: sah.approvedBy, pada: sah.approvedAt } : null,
          mapel,
        };
      }),
    })),
  });
}

async function ambilBody(req: Request) {
  const b = await req.json().catch(() => null) as { classId?: unknown; semester?: unknown } | null;
  const classId = typeof b?.classId === "string" ? b.classId : "";
  const semester = typeof b?.semester === "string" ? b.semester : "";
  return { classId, semester };
}

export async function POST(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const { classId, semester } = await ambilBody(req);
  if (!classId || !semesterRapor().includes(semester)) return Response.json({ error: "Kelas dan semester wajib dipilih." }, { status: 400 });
  const boleh = await kelasBoleh(session);
  if (boleh && !boleh.includes(classId)) return Response.json({ error: "Hanya wali kelas yang dapat mengunci nilai kelas ini." }, { status: 403 });
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  if (!kelas) return Response.json({ error: "Kelas tidak ditemukan." }, { status: 404 });
  await prisma.raporKunci.upsert({
    where: { classId_semester: { classId, semester } },
    create: { classId, semester, lockedBy: session.name, lockedById: session.userId },
    update: {},
  });
  await logActivity(session, { action: "KUNCI_NILAI_RAPOR", entity: "RaporKunci", entityId: classId, description: `Mengunci nilai rapor ${kelas.name} semester ${semester}` }).catch(() => {});
  segarkanAntrean();
  return Response.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const { classId, semester } = await ambilBody(req);
  const boleh = await kelasBoleh(session);
  if (boleh && !boleh.includes(classId)) return Response.json({ error: "Hanya wali kelas yang dapat membuka kunci kelas ini." }, { status: 403 });
  const sah = await prisma.raporApproval.findUnique({ where: { classId_semester: { classId, semester } } });
  if (sah) return Response.json({ error: "Rapor semester ini sudah disahkan Kepala Sekolah. Minta pengesahannya dibatalkan dulu." }, { status: 409 });
  const hapus = await prisma.raporKunci.deleteMany({ where: { classId, semester } });
  if (!hapus.count) return Response.json({ error: "Nilai semester ini memang belum dikunci." }, { status: 404 });
  const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { name: true } });
  await logActivity(session, { action: "BUKA_KUNCI_NILAI_RAPOR", entity: "RaporKunci", entityId: classId, description: `Membuka kunci nilai rapor ${kelas?.name ?? classId} semester ${semester}` }).catch(() => {});
  segarkanAntrean();
  return Response.json({ ok: true });
}
