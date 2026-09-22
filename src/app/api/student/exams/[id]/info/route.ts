import { prisma } from "@/lib/prisma";
import { alasanDitahan, pesanDitahan } from "@/lib/peserta-ditahan";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, ujianUntukSiswa } from "@/lib/ujian-server";
import { labelTipe, hitungBelumDikoreksi } from "@/lib/soal";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/** Berapa lama sejak denyut terakhir attempt masih dianggap "sedang dibuka di perangkat lain". */
const DENYUT_MS = 2 * 60_000;

/** KONFIRMASI & PETUNJUK UJIAN — keterangan ujian SEBELUM siswa menekan Mulai.
 * Sengaja terpisah dari `/api/student/exams/[id]` (muatan soal): membuka halaman ini TIDAK
 * membuat attempt dan TIDAK menjalankan jam. Tidak ada satu pun isi soal di sini. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Akun Anda belum terhubung ke kelas." }, { status: 403 });
    const { id } = await params;

    const exam = await prisma.exam.findFirst({
      where: { id, ...ujianUntukSiswa(student.classId, student.id), isPublished: true },
      include: {
        teacher: { select: { user: { select: { name: true } } } },
        class: { select: { name: true } },
        kegiatan: { select: { nama: true, singkatan: true, semester: true, academicYear: { select: { name: true } } } },
        questions: { select: { tipe: true, skor: true } },
        attempts: { where: { studentId: student.id }, select: { startedAt: true, lastSeenAt: true, submittedAt: true, score: true, skorButir: true } },
      },
    });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan atau bukan untuk kelas Anda." }, { status: 404 });

    const hitung = new Map<string, number>();
    for (const q of exam.questions) hitung.set(q.tipe, (hitung.get(q.tipe) ?? 0) + 1);
    const rincian = [...hitung.entries()].map(([tipe, jumlah]) => ({ tipe, label: labelTipe(tipe), jumlah }));

    const a = exam.attempts[0] ?? null;
    const now = Date.now();
    const total = exam.questions.length;
    const dikerjakan = exam.jumlahDikerjakan && exam.jumlahDikerjakan < total ? exam.jumlahDikerjakan : total;

    const pengaturan = await getSettings(["ujian.petunjukTambahan"]);
    // Ditahan panitia — hanya menghalangi yang BELUM mulai (src/lib/peserta-ditahan.ts).
    const ditahan = a ? null : await alasanDitahan(exam.kegiatanId, student.id);
    // Ujian bisa diikuti banyak kelas — yang ditampilkan ke peserta adalah kelasnya sendiri.
    const kelasSiswa = await prisma.class.findUnique({ where: { id: student.classId }, select: { name: true } });
    return Response.json({
      kegiatan: exam.kegiatan ? { nama: exam.kegiatan.nama, singkatan: exam.kegiatan.singkatan, semester: exam.kegiatan.semester, tahunAjaran: exam.kegiatan.academicYear?.name ?? null } : null,
      petunjukTambahan: pengaturan["ujian.petunjukTambahan"] || "",
      id: exam.id, judul: exam.title, deskripsi: exam.description, mapel: exam.subject,
      guru: exam.teacher.user.name, kelas: kelasSiswa?.name ?? exam.class.name, durasi: exam.duration,
      mulai: jendelaKelas(exam, student.classId).startTime.toISOString(), tutup: jendelaKelas(exam, student.classId).endTime.toISOString(), serverNow: new Date(now).toISOString(),
      totalSoal: total, jumlahDikerjakan: dikerjakan, disampel: dikerjakan < total,
      totalSkor: exam.questions.reduce((n, q) => n + q.skor, 0),
      rincian,
      perluExamkey: !!exam.examkey,
      acakSoal: exam.acakSoal, acakOpsi: exam.acakOpsi,
      batasPindahTab: exam.batasPindahTab, tampilkanNilai: exam.tampilkanNilai,
      izinKalkulator: exam.izinKalkulator, izinCoretan: exam.izinCoretan,
      sudahMulai: !!a, sudahSelesai: !!a?.submittedAt,
      ditahan: ditahan ? pesanDitahan(ditahan) : null,
      nilai: a?.submittedAt && exam.tampilkanNilai ? a.score : null,
      nilaiSementara: !!a?.submittedAt && exam.tampilkanNilai && hitungBelumDikoreksi(a.skorButir) > 0,
      /** Peringatan "akun sedang aktif di perangkat lain": attempt yang belum dikumpulkan tapi
       * denyutnya baru saja — biasanya komputer lain yang masih membuka halaman ujian ini. */
      aktifDiPerangkatLain: !!a && !a.submittedAt && now - new Date(a.lastSeenAt).getTime() < DENYUT_MS
        ? Math.max(1, Math.round((now - new Date(a.lastSeenAt).getTime()) / 1000))
        : null,
    });
  } catch {
    return Response.json({ error: "Gagal memuat keterangan ujian." }, { status: 500 });
  }
}
