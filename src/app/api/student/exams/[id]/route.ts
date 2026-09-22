import { prisma } from "@/lib/prisma";
import { butirBerparameter, isiButirParameter } from "@/lib/soal-parameter";
import { variabelSiswaUjian } from "@/lib/soal-parameter-server";
import { pesanUntukSiswa } from "@/lib/pesan-ujian";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, tenggat, urutanUntukAttempt, soalUntukSiswa, jagaAttempt, tambahJejak, HEADER_PERANGKAT, type Jejak, ujianUntukSiswa } from "@/lib/ujian-server";
import { type Jawaban } from "@/lib/soal";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Muatan ujian untuk siswa. Kunci TIDAK PERNAH ikut sebelum dikumpulkan. Setelah dikumpulkan,
 * kunci dan skor per butir ikut hanya kalau guru mengizinkan (`tampilkanNilai`).
 *
 * Soal dikirim sesuai urutan hasil pengacakan milik siswa ini. Kalau `satuSoalPerHalaman`,
 * klien memuat `?nomor=` satu per satu; muatan awal tetap membawa daftar ringkas (id, tipe,
 * sudah dijawab?) untuk peta navigasi.
 *
 * Sebelum apa pun, `jagaAttempt` memeriksa kunci perangkat & kunci terputus (423 kalau ditolak). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const nomorParam = new URL(req.url).searchParams.get("nomor");

    const exam = await prisma.exam.findFirst({
      where: { id, ...ujianUntukSiswa(student.classId, student.id), isPublished: true },
      include: {
        teacher: { select: { user: { select: { name: true } } } },
        kegiatan: { select: { nama: true, singkatan: true } },
        questions: { orderBy: { order: "asc" }, include: { stimulus: { select: { id: true, judul: true, konten: true } } } },
      },
    });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } });
    if (!attempt) return Response.json({ error: "Anda belum masuk ke ujian ini. Masukkan token dulu." }, { status: 403 });

    // SETELAH DIKUMPULKAN peserta TIDAK boleh melihat lagi soal, jawabannya, atau mana yang benar/
    // salah — tidak dikirim sama sekali, jadi tidak bisa diintip lewat alamat langsung maupun alat
    // pengembang browser. Halaman ujian mengalihkan ke beranda peserta (keputusan user 13 Sep 2026).
    if (attempt.submittedAt) return Response.json({ id: exam.id, title: exam.title, submitted: true });

    const jaga = await jagaAttempt(attempt, req.headers.get(HEADER_PERANGKAT));
    if (jaga.tolak) return jaga.tolak;

    const urutan = await urutanUntukAttempt(attempt, exam, exam.questions);
    // Soal berparameter ({ABSEN}, {NIS2}, …): angkanya diisi milik siswa ini sebelum dikirim (src/lib/soal-parameter.ts).
    let soalUjian = exam.questions;
    if (soalUjian.some(q => butirBerparameter(q))) {
      const v = (await variabelSiswaUjian(exam.id, [student.id])).get(student.id);
      if (v) soalUjian = soalUjian.map(q => isiButirParameter(q, v));
    }
    const perId = new Map(soalUjian.map(q => [q.id, q]));
    const daftar = urutan.urutanSoal.map(qid => perId.get(qid)).filter((q): q is NonNullable<typeof q> => !!q);
    const submitted = !!attempt.submittedAt;
    const batas = tenggat(attempt.startedAt, exam.duration, jendelaKelas(exam, student.classId).endTime, attempt.tambahanMenit);
    const jawaban = (attempt.answers as Record<string, Jawaban>) ?? {};
    const bolehLihat = submitted && exam.tampilkanNilai;

    // denyut + jejak "membuka halaman ujian" (hanya muatan awal, bukan tiap pindah nomor)
    if (!submitted) {
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { lastSeenAt: new Date(), ...(nomorParam ? {} : { jejak: tambahJejak(jaga.jejak, { jenis: "BUKA_HALAMAN" }) as object }) },
      });
    }

    const peta = daftar.map((q, i) => ({ id: q.id, nomor: i + 1, tipe: q.tipe, dijawab: jawaban[q.id] != null && jawaban[q.id] !== "" }));
    let soal;
    if (nomorParam && exam.satuSoalPerHalaman && !submitted) {
      const n = Math.max(1, Math.min(daftar.length, Number(nomorParam) || 1));
      const q = daftar[n - 1];
      soal = q ? [soalUntukSiswa(q, n, urutan.urutanOpsi[q.id], false, attempt.startedAt)] : [];
    } else if (exam.satuSoalPerHalaman && !submitted) {
      const q = daftar[0];
      soal = q ? [soalUntukSiswa(q, 1, urutan.urutanOpsi[q.id], false, attempt.startedAt)] : [];
    } else {
      soal = daftar.map((q, i) => soalUntukSiswa(q, i + 1, urutan.urutanOpsi[q.id], bolehLihat, attempt.startedAt));
    }

    // Hitungan putar audio per soal dari jejak — batasnya dijaga server, bukan hanya di layar.
    const putarAudio: Record<string, number> = {};
    for (const j of (Array.isArray(jaga.jejak) ? (jaga.jejak as Jejak[]) : [])) {
      if (j.jenis === "PUTAR_AUDIO" && j.ket) putarAudio[j.ket] = (putarAudio[j.ket] ?? 0) + 1;
    }

    return Response.json({
      id: exam.id, title: exam.title, description: exam.description, subject: exam.subject, duration: exam.duration,
      teacher: exam.teacher, satuSoalPerHalaman: exam.satuSoalPerHalaman, batasPindahTab: exam.batasPindahTab,
      startedAt: attempt.startedAt, deadline: batas, serverNow: new Date(), submitted,
      score: bolehLihat ? attempt.score : null, tampilkanNilai: exam.tampilkanNilai,
      skorButir: bolehLihat ? attempt.skorButir : undefined,
      jawaban, peta, soal, jumlah: daftar.length,
      ragu: Array.isArray(attempt.ragu) ? attempt.ragu : [],
      batasPutarAudio: exam.batasPutarAudio, putarAudio,
      izinKalkulator: exam.izinKalkulator, izinCoretan: exam.izinCoretan,
      // Identitas untuk watermark layar — foto layar yang bocor langsung ketahuan milik siapa.
      peserta: { nama: student.user.name, nis: student.nis },
      kegiatan: exam.kegiatan,
      versiSoal: exam.questions.reduce<string | null>((v, q) => {
        const t = q.diperbaruiLiveAt?.toISOString() ?? null;
        return t && (!v || t > v) ? t : v;
      }, null),
      pelanggaran: Array.isArray(attempt.pelanggaran) ? (attempt.pelanggaran as unknown[]).length : 0,
      // Pesan pengawas — hanya di muatan awal (bukan tiap ambil satu soal); selanjutnya lewat denyut.
      pesan: nomorParam || submitted ? undefined : await pesanUntukSiswa(exam.id, student),
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}
