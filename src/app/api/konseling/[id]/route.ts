import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { peranBk } from "@/lib/bk-akses";
import { segarkanAntrean } from "@/lib/antrean-kerja";
import { kirimLatar, kirimNotifikasi } from "@/lib/push-server";

export const dynamic = "force-dynamic";

/** BK/Kesiswaan/Admin: jadwalkan, selesaikan (opsional catat ke Rekam BK), batalkan. Siswa/pengaju: batalkan yang masih menunggu. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifyRole(["STUDENT", "TEACHER", "ADMIN", "TAS", "PARENT"]);
  const p = await peranBk(session);
  const { id } = await params;
  const j = await prisma.janjiKonseling.findUnique({ where: { id }, include: { student: { select: { userId: true, classId: true, user: { select: { name: true } } } } } });
  if (!j) return Response.json({ error: "Tidak ditemukan." }, { status: 404 });
  const b = await req.json().catch(() => ({})) as { aksi?: string; jadwal?: string; tempat?: string; catatan?: string; rekamBk?: boolean };
  // Wali kelas boleh mengatur janji temu yang DITUJUKAN kepadanya (permintaan orang tua di kelas walinya).
  const waliTujuan = !p.bk && j.tujuan === "WALI_KELAS" && !!j.student.classId && p.waliKelas.includes(j.student.classId);
  if (!p.bk && !waliTujuan) {
    const pemilik = j.pengajuId === session.userId || (p.siswaId && j.studentId === p.siswaId);
    if (!pemilik || b.aksi !== "batal" || j.status !== "MENUNGGU") return Response.json({ error: "Tidak berhak." }, { status: 403 });
    await prisma.janjiKonseling.update({ where: { id }, data: { status: "DIBATALKAN" } });
    segarkanAntrean();
    return Response.json({ ok: true });
  }
  if (b.aksi === "jadwal") {
    const d = new Date(b.jadwal ?? "");
    if (isNaN(d.getTime())) return Response.json({ error: "Jadwal tidak valid." }, { status: 400 });
    await prisma.janjiKonseling.update({ where: { id }, data: { status: "DIJADWALKAN", jadwal: d, tempat: (b.tempat ?? "Ruang BK").slice(0, 100), konselorNama: session.name } });
    kirimLatar(() => kirimNotifikasi({
      userIds: [j.student.userId, j.pengajuId].filter((x, i, a) => a.indexOf(x) === i), jenis: "KONSELING", kunci: `konseling-jadwal:${id}:${d.getTime()}`,
      judul: "Jadwal konseling ditetapkan",
      isi: `${d.toLocaleString("id-ID", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" })} WIB di ${b.tempat ?? "Ruang BK"} bersama ${session.name}.`,
      url: j.sumber === "SISWA" ? "/dashboard/student/konseling" : j.sumber === "ORANG_TUA" ? "/dashboard/parent/konseling" : "/dashboard/teacher/konseling", tag: `konseling-${id}`,
    }));
    segarkanAntrean();
    return Response.json({ ok: true });
  }
  if (b.aksi === "selesai") {
    const catatan = (b.catatan ?? "").trim().slice(0, 5000);
    await prisma.$transaction(async tx => {
      await tx.janjiKonseling.update({ where: { id }, data: { status: "SELESAI", catatanKonselor: catatan || null, konselorNama: j.konselorNama ?? session.name } });
      if (b.rekamBk && catatan) {
        await tx.studentCaseNote.create({
          data: { studentId: j.studentId, handlingType: "Konseling", note: `[${j.topik}] ${catatan}`, status: "BERJALAN", handledByName: session.name, handledByRole: "Guru BK" },
        });
      }
    });
    segarkanAntrean();
    return Response.json({ ok: true });
  }
  if (b.aksi === "batal") {
    await prisma.janjiKonseling.update({ where: { id }, data: { status: "DIBATALKAN" } });
    segarkanAntrean();
    return Response.json({ ok: true });
  }
  return Response.json({ error: "Aksi tidak dikenal." }, { status: 400 });
}
