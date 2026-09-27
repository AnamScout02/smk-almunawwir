import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, simpanNilaiAttempt, tenggat, tambahanUntukSisa, tambahJejak } from "@/lib/ujian-server";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** PUSAT RESET per siswa — tindakan pengawas atas satu pengerjaan. Semua tercatat di jejak
 * aktivitas siswa itu (siapa pengawasnya, kapan).
 *
 *   "reset-login"  : lepas kunci perangkat — siswa boleh masuk dari komputer lain. Jawaban TETAP.
 *   "tambah-waktu" : sisa waktu + `menit` (khusus siswa ini). Jawaban TETAP.
 *   "reset-waktu"  : sisa waktu kembali ke durasi penuh. Jawaban TETAP.
 *   "buka-selesai" : status Selesai → Mengerjakan lagi (salah pencet Kumpulkan). Jawaban TETAP;
 *                    waktu berlanjut dari sisa, minimal `menit` (bawaan 10) kalau sudah habis.
 *   "buka-kunci"   : buka pengerjaan yang terkunci (terputus terlalu lama / dikunci pengawas).
 *   "kunci"        : kunci pengerjaan sekarang (mis. dugaan kecurangan) sampai dibuka lagi.
 *   "kumpulkan"    : paksa kumpulkan & nilai sekarang.
 *   "ulang"        : HAPUS pengerjaan — jawaban hilang, siswa mulai dari awal.
 *   "lanjutkan"    : (lama) sama dengan buka-selesai / tambah sampai sisa 15 menit. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const { studentId, aksi, menit, tambahMenit } = await req.json();
    const attempt = await prisma.examAttempt.findUnique({
      where: { examId_studentId: { examId: id, studentId } },
      include: { student: { select: { classId: true, user: { select: { name: true } } } } },
    });
    if (!attempt) return Response.json({ error: "Siswa ini belum pernah membuka ujian." }, { status: 404 });
    const nama = attempt.student.user.name;
    const oleh = session.name;
    const sekarang = Date.now();
    // Jam tutup mengikuti KELAS siswa (kegiatan per kelas memakai jam berbeda per kelas).
    const kelasUjian = { duration: exam.duration, endTime: jendelaKelas(exam, attempt.student.classId).endTime };
    const sisaMenit = Math.max(0, (tenggat(attempt.startedAt, exam.duration, kelasUjian.endTime, attempt.tambahanMenit).getTime() - sekarang) / 60_000);
    const m = Math.min(240, Math.max(1, Math.round(Number(menit ?? tambahMenit) || 0)));
    const jejak = (jenis: string, ket?: string) => tambahJejak(attempt.jejak, { jenis, ket, oleh }) as object;

    switch (aksi) {
      case "ulang": {
        await prisma.examAttempt.delete({ where: { id: attempt.id } });
        await logActivity(session, { action: "ULANG_UJIAN_SISWA", entity: "ExamAttempt", entityId: attempt.id, description: `Menghapus pengerjaan ${nama} pada ujian "${exam.title}"` });
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `Pengerjaan ${nama} dihapus — ia bisa mulai dari awal dengan token.` });
      }
      case "kumpulkan": {
        if (attempt.submittedAt) return Response.json({ error: "Sudah dikumpulkan." }, { status: 400 });
        await prisma.examAttempt.update({ where: { id: attempt.id }, data: { submittedAt: new Date(), jejak: jejak("KUMPUL_PAKSA") } });
        await simpanNilaiAttempt(attempt.id);
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `Jawaban ${nama} dikumpulkan dan dinilai.` });
      }
      case "reset-login": {
        await prisma.examAttempt.update({
          where: { id: attempt.id },
          data: { perangkatId: null, terkunci: false, alasanKunci: null, lastSeenAt: new Date(), jejak: jejak("RESET_LOGIN") },
        });
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `Login ${nama} direset — ia bisa masuk lagi dari perangkat mana pun. Jawaban tetap tersimpan.` });
      }
      case "buka-kunci": {
        await prisma.examAttempt.update({ where: { id: attempt.id }, data: { terkunci: false, alasanKunci: null, lastSeenAt: new Date(), jejak: jejak("BUKA_KUNCI") } });
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `Kunci ${nama} dibuka.` });
      }
      case "kunci": {
        if (attempt.submittedAt) return Response.json({ error: "Sudah dikumpulkan." }, { status: 400 });
        await prisma.examAttempt.update({ where: { id: attempt.id }, data: { terkunci: true, alasanKunci: `Dikunci pengawas (${oleh}). Tunggu arahan pengawas.`, jejak: jejak("KUNCI_PENGAWAS") } });
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `Pengerjaan ${nama} dikunci.` });
      }
      case "tambah-waktu": {
        if (attempt.submittedAt) return Response.json({ error: "Siswa sudah mengumpulkan — pakai Buka Kembali." }, { status: 400 });
        const t = tambahanUntukSisa(attempt, kelasUjian, sisaMenit + m, sekarang);
        await prisma.examAttempt.update({ where: { id: attempt.id }, data: { tambahanMenit: t, lastSeenAt: new Date(), dilanjutkanOleh: session.userId, jejak: jejak("TAMBAH_WAKTU", `+${m} menit`) } });
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `${nama} mendapat tambahan ${m} menit.` });
      }
      case "reset-waktu": {
        if (attempt.submittedAt) return Response.json({ error: "Siswa sudah mengumpulkan — pakai Buka Kembali." }, { status: 400 });
        const t = tambahanUntukSisa(attempt, kelasUjian, exam.duration, sekarang);
        await prisma.examAttempt.update({ where: { id: attempt.id }, data: { tambahanMenit: t, lastSeenAt: new Date(), dilanjutkanOleh: session.userId, jejak: jejak("RESET_WAKTU", `${exam.duration} menit penuh`) } });
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `Waktu ${nama} dikembalikan ke ${exam.duration} menit penuh.` });
      }
      case "buka-selesai":
      case "lanjutkan": {
        const target = aksi === "lanjutkan" && !attempt.submittedAt ? Math.max(sisaMenit, 15)
          : Math.max(sisaMenit, Number(menit ?? tambahMenit) ? m : 10);
        const t = tambahanUntukSisa(attempt, kelasUjian, target, sekarang);
        await prisma.examAttempt.update({
          where: { id: attempt.id },
          data: {
            submittedAt: null, score: null, tambahanMenit: t, terkunci: false, alasanKunci: null,
            lastSeenAt: new Date(), dilanjutkanOleh: session.userId,
            jejak: jejak(attempt.submittedAt ? "BUKA_SELESAI" : "LANJUTKAN", `sisa ${Math.round(target)} menit`),
          },
        });
        if (attempt.submittedAt) {
          await logActivity(session, { action: "BUKA_KEMBALI_UJIAN", entity: "ExamAttempt", entityId: attempt.id, description: `Membuka kembali pengerjaan ${nama} pada ujian "${exam.title}"` });
        }
        kirimSinyal(id, [studentId]); return Response.json({ ok: true, pesan: `${nama} boleh melanjutkan — sisa waktu ${Math.round(target)} menit, jawaban tetap tersimpan.` });
      }
    }
    return Response.json({ error: "Tindakan tidak dikenal." }, { status: 400 });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memproses." }, { status: 500 });
  }
}
