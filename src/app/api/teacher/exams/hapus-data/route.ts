import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { cakupanUjian, ujianDalamCakupan, petaNamaKelas } from "@/lib/ujian-server";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Seberapa lama siswa dianggap "masih di layar ujian" sejak denyut terakhir. */
const DENYUT_MS = 5 * 60_000;

type UjianRingkas = {
  id: string; judul: string; mapel: string; kelas: string; guru: string;
  soal: number; peserta: number; selesai: number; sedangMengerjakan: number;
  mulai: string; tutup: string; terbit: boolean;
  status: "AKAN_DATANG" | "BERLANGSUNG" | "SELESAI";
  /** true = ADA siswa yang sedang mengerjakan SEKARANG — dilarang dihapus tanpa paksa. */
  sedangDipakai: boolean;
};

async function ringkasan(session: { role: string; email: string }) {
  const teacherId = await cakupanUjian(session);
  const [exams, bankSoal, wacana] = await Promise.all([
    prisma.exam.findMany({
      where: teacherId ? { teacherId } : {},
      include: {
        class: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
        _count: { select: { questions: true, attempts: true } },
        attempts: { select: { submittedAt: true, lastSeenAt: true } },
      },
      orderBy: { startTime: "desc" },
    }),
    prisma.questionBankItem.count({ where: teacherId ? { teacherId } : {} }),
    prisma.examStimulus.count({ where: teacherId ? { teacherId } : {} }),
  ]);
  const kelas = await petaNamaKelas(exams);

  const now = Date.now();
  const ujian: UjianRingkas[] = exams.map(e => {
    const mulai = new Date(e.startTime).getTime(), tutup = new Date(e.endTime).getTime();
    const status = now < mulai ? "AKAN_DATANG" : now > tutup ? "SELESAI" : "BERLANGSUNG";
    const aktif = e.attempts.filter(a => !a.submittedAt && a.lastSeenAt && now - new Date(a.lastSeenAt).getTime() < DENYUT_MS).length;
    return {
      id: e.id, judul: e.title, mapel: e.subject, kelas: kelas.label(e), guru: e.teacher.user.name,
      soal: e._count.questions, peserta: e._count.attempts,
      selesai: e.attempts.filter(a => a.submittedAt).length,
      sedangMengerjakan: aktif,
      mulai: e.startTime.toISOString(), tutup: e.endTime.toISOString(), terbit: e.isPublished,
      status: status as UjianRingkas["status"],
      sedangDipakai: status === "BERLANGSUNG" && (aktif > 0 || e.attempts.some(a => !a.submittedAt)),
    };
  });

  return {
    lingkup: teacherId ? "guru" : "sekolah",
    ujian, bankSoal, wacana,
    pengerjaan: ujian.reduce((n, u) => n + u.peserta, 0),
    /** Judul ujian yang SEDANG BERLANGSUNG — ditampilkan mencolok di layar supaya tidak ada yang
     * menghapus/mereset ujian yang siswanya masih mengerjakan (permintaan user 13 Sep 2026). */
    berlangsung: ujian.filter(u => u.status === "BERLANGSUNG").map(u => ({
      id: u.id, judul: u.judul, kelas: u.kelas, mapel: u.mapel,
      sedangMengerjakan: u.sedangMengerjakan, tutup: u.tutup,
    })),
  };
}

export async function GET() {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    return Response.json(await ringkasan(session));
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat data." }, { status: 500 });
  }
}

/** HAPUS DATA UJIAN — padanan "Reset Database" pada CBT Bimasoft.
 *
 * Empat tingkat, dari yang paling ringan. Semuanya TIDAK BISA DIBATALKAN, jadi antarmuka
 * mewajibkan mengunduh cadangan lebih dulu dan mengetik ulang kata penegas.
 *
 *   "hasil-ujian"  : hapus seluruh PENGERJAAN satu ujian (jawaban & nilai). Soal & pengaturan
 *                    TETAP — dipakai kalau ujian mau diulang dari nol untuk kelas yang sama.
 *   "ujian"        : hapus satu ujian beserta soal & pengerjaannya.
 *   "ujian-lama"   : hapus semua ujian yang sudah lewat lebih dari N hari (bersih-bersih arsip).
 *   "semua"        : hapus SELURUH data ujian — ujian, soal, pengerjaan, bank soal, wacana.
 *                    KHUSUS ADMIN + wajib mengetik kata penegas.
 *
 * PENGAMAN: ujian yang SEDANG BERLANGSUNG (jam ujian masih jalan dan masih ada peserta belum
 * mengumpulkan) ditolak — kalau benar-benar disengaja, kirim `paksa: true`.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { aksi, examId, hari, penegas, paksa } = await req.json();
    const teacherId = await cakupanUjian(session);
    const now = Date.now();

    /** Ujian ini masih dipakai siswa? (dipakai sebagai pengaman sebelum menghapus) */
    const masihDipakai = async (id: string) => {
      const e = await prisma.exam.findUnique({
        where: { id },
        select: { startTime: true, endTime: true, attempts: { select: { submittedAt: true } } },
      });
      if (!e) return false;
      const jalan = now >= new Date(e.startTime).getTime() && now <= new Date(e.endTime).getTime();
      return jalan && e.attempts.some(a => !a.submittedAt);
    };

    if (aksi === "hasil-ujian" || aksi === "ujian") {
      const exam = await ujianDalamCakupan(session, String(examId ?? ""), { ubah: true });
      if (!exam) return Response.json({ error: "Ujian tidak ditemukan." }, { status: 404 });
      if (!paksa && await masihDipakai(exam.id)) {
        return Response.json({
          error: `"${exam.title}" SEDANG BERLANGSUNG dan masih ada peserta yang belum mengumpulkan. Tunggu sampai selesai, atau centang "saya tetap ingin menghapus".`,
        }, { status: 409 });
      }
      if (aksi === "hasil-ujian") {
        const n = await prisma.examAttempt.deleteMany({ where: { examId: exam.id } });
        await logActivity(session, {
          action: "HAPUS_HASIL_UJIAN", entity: "Exam", entityId: exam.id,
          description: `Menghapus ${n.count} pengerjaan pada ujian "${exam.title}"`,
        });
        return Response.json({ ok: true, jumlah: n.count, pesan: `${n.count} pengerjaan dihapus. Soal & pengaturan tetap — ujian siap diulang.` });
      }
      const jml = await prisma.examAttempt.count({ where: { examId: exam.id } });
      await prisma.exam.delete({ where: { id: exam.id } });
      await logActivity(session, {
        action: "HAPUS_UJIAN", entity: "Exam", entityId: exam.id,
        description: `Menghapus ujian "${exam.title}" beserta ${jml} pengerjaan`,
      });
      return Response.json({ ok: true, jumlah: 1, pesan: `Ujian "${exam.title}" dihapus beserta ${jml} pengerjaan.` });
    }

    if (aksi === "ujian-lama") {
      const n = Math.max(1, Number(hari) || 365);
      const batas = new Date(now - n * 24 * 60 * 60 * 1000);
      const target = await prisma.exam.findMany({
        where: { ...(teacherId ? { teacherId } : {}), endTime: { lt: batas } },
        select: { id: true, title: true },
      });
      if (!target.length) return Response.json({ ok: true, jumlah: 0, pesan: `Tidak ada ujian yang selesai lebih dari ${n} hari lalu.` });
      await prisma.exam.deleteMany({ where: { id: { in: target.map(t => t.id) } } });
      await logActivity(session, {
        action: "HAPUS_UJIAN_LAMA", entity: "Exam",
        description: `Menghapus ${target.length} ujian yang selesai lebih dari ${n} hari lalu`,
        metadata: { judul: target.map(t => t.title) },
      });
      return Response.json({ ok: true, jumlah: target.length, pesan: `${target.length} ujian lama dihapus.` });
    }

    if (aksi === "semua") {
      if (session.role !== "ADMIN") return Response.json({ error: "Hanya Administrator yang boleh menghapus seluruh data ujian." }, { status: 403 });
      if (String(penegas ?? "").trim().toUpperCase() !== "HAPUS SEMUA DATA UJIAN") {
        return Response.json({ error: 'Ketik persis "HAPUS SEMUA DATA UJIAN" untuk menegaskan.' }, { status: 400 });
      }
      const jalan = await prisma.exam.findMany({
        where: { startTime: { lte: new Date(now) }, endTime: { gte: new Date(now) } },
        select: { title: true, attempts: { select: { submittedAt: true } } },
      });
      const dipakai = jalan.filter(e => e.attempts.some(a => !a.submittedAt)).map(e => e.title);
      if (!paksa && dipakai.length) {
        return Response.json({ error: `Masih ada ujian berlangsung: ${dipakai.join(", ")}. Tunggu selesai, atau centang penegasan.` }, { status: 409 });
      }
      const [u, b, w] = await Promise.all([prisma.exam.count(), prisma.questionBankItem.count(), prisma.examStimulus.count()]);
      await prisma.$transaction([
        prisma.exam.deleteMany({}),
        prisma.questionBankItem.deleteMany({}),
        prisma.examStimulus.deleteMany({}),
      ]);
      await logActivity(session, {
        action: "RESET_DATA_UJIAN", entity: "Exam",
        description: `Menghapus SELURUH data ujian: ${u} ujian, ${b} butir bank soal, ${w} wacana`,
      });
      return Response.json({ ok: true, jumlah: u + b + w, pesan: `Seluruh data ujian dihapus: ${u} ujian, ${b} soal bank, ${w} wacana.` });
    }

    return Response.json({ error: "Tindakan tidak dikenal." }, { status: 400 });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menghapus data." }, { status: 500 });
  }
}
