import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { assertStudentPointsFull } from "@/lib/kesiswaan-guard";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

/** Rekam BK / Penanganan Siswa — catatan naratif per kejadian (konseling, panggilan orang tua,
 * dll), TERPISAH dari poin pelanggaran/prestasi. Akses khusus BK & Wakasek Kesiswaan (ADMIN
 * otomatis lolos) — TIDAK ada jalur guru piket di sini sama sekali, beda dgn student-points
 * (isi rekam ini bisa sensitif, privasi konseling). Lihat kesiswaan-guard.ts. */
export async function GET(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const status = searchParams.get("status");

    const notes = await prisma.studentCaseNote.findMany({
      where: {
        ...(studentId ? { studentId } : {}),
        ...(status ? { status } : {}),
      },
      include: {
        student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } },
      },
      orderBy: { date: "desc" },
      take: 500,
    });
    return Response.json(notes);
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await verifyRole(["ADMIN", "TEACHER", "TAS"]);
    await assertStudentPointsFull(session);

    const body = await req.json();
    const { studentId, handlingType, note, status } = body as {
      studentId: string; handlingType: string; note: string; status?: string;
    };
    if (!studentId || !handlingType?.trim() || !note?.trim()) {
      return Response.json({ error: "Siswa, jenis penanganan, dan catatan wajib diisi" }, { status: 400 });
    }
    const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
    if (!student) return Response.json({ error: "Siswa tidak ditemukan" }, { status: 404 });

    const created = await prisma.studentCaseNote.create({
      data: {
        studentId, handlingType: handlingType.trim(), note: note.trim(),
        status: status === "SELESAI" ? "SELESAI" : "BERJALAN",
        handledByName: session.name, handledByRole: session.role,
      },
    });
    return Response.json(created, { status: 201 });
  } catch (e) {
    lemparBilaPengalihan(e);
    if (e instanceof Error && e.message === "FORBIDDEN") return Response.json({ error: "Khusus Wakasek Kesiswaan/Guru BK." }, { status: 403 });
    return Response.json({ error: "Gagal menyimpan catatan" }, { status: 500 });
  }
}
