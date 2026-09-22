import { prisma } from "@/lib/prisma";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import { logActivity } from "@/lib/activity-log";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const { nis, nisn, majorId, classId } = await req.json();

    const before = await prisma.student.findUnique({ where: { id }, select: { classId: true, class: { select: { name: true } } }, });

    const student = await prisma.student.update({
      where: { id },
      // `nisn: nisn || null` HANYA aman kalau caller SELALU kirim nisn eksplisit (form lengkap) —
      // kalau suatu saat ada caller yang cuma kirim sebagian field (mis. cuma classId dari modal
      // "Pindah Kelas"), nisn undefined akan ke-NULL-kan diam-diam. Guard `nisn !== undefined` di
      // sini mencegah itu tanpa mengubah perilaku caller lama yang memang selalu kirim field penuh.
      data: {
        nis, majorId,
        ...(nisn !== undefined ? { nisn: nisn || null } : {}),
        ...(classId !== undefined ? { classId: classId || null } : {}),
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        class: true,
        major: true,
      },
    });

    // Pindah kelas (classId berubah) — biodata inti, catat ke ActivityLog + sinkronkan riwayat
    // kelas tahun ajaran aktif kalau sudah ada barisnya (dibuat oleh proses Naik Kelas tahunan),
    // supaya laporan riwayat tidak menyimpang dari kelas terbaru siswa.
    if (before && classId !== undefined && before.classId !== (classId || null)) {
      await logActivity(session, {
        action: "MOVE_CLASS", entity: "Student", entityId: id,
        description: `${session.name} memindahkan siswa "${student.user.name}" dari kelas "${before.class?.name ?? "(belum ada kelas)"}" ke "${student.class?.name ?? "(tanpa kelas)"}"`,
        metadata: { fromClassId: before.classId, toClassId: classId || null },
      });

      const activeYear = await prisma.academicYear.findFirst({ where: { isActive: true } });
      if (activeYear) {
        await prisma.studentClassHistory.updateMany({
          where: { studentId: id, academicYearId: activeYear.id },
          data: { classId: student.classId, grade: student.class?.grade ?? null, majorName: student.major.name, className: student.class?.name ?? null },
        }).catch(() => {});
      }
    }

    return Response.json(student);
  } catch {
    return Response.json({ error: "Gagal mengupdate siswa" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyTasAccess();
    const { id } = await params;
    const student = await prisma.student.delete({ where: { id }, include: { user: { select: { name: true } } } });
    await logActivity(session, {
      action: "DELETE_STUDENT", entity: "Student", entityId: id,
      description: `${session.name} menghapus data siswa "${student.user.name}" (NIS ${student.nis})`,
    });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus" }, { status: 500 });
  }
}
