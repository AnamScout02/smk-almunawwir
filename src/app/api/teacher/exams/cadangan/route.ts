import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { cakupanUjian, petaNamaKelas } from "@/lib/ujian-server";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { kunciKeTeks } from "@/lib/soal-kunci";
import { labelTipe, type Opsi, type Kunci, type Jawaban } from "@/lib/soal";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** CADANGAN DATA UJIAN - padanan "Export Database" pada CBT offline Bimasoft.
 *
 * Dua bentuk, dua tujuan berbeda:
 *   ?format=json  -> cadangan LENGKAP & bisa dipulihkan: bank soal, wacana, ujian, butir soal,
 *                    dan seluruh jawaban siswa apa adanya. Ini yang disimpan sebelum menghapus
 *                    data atau sebelum tahun ajaran berganti.
 *   ?format=xlsx  -> cadangan yang BISA DIBACA MANUSIA: soal + kunci + nilai per siswa, untuk
 *                    arsip kertas/Drive sekolah. Tidak bisa dipulihkan kembali ke sistem.
 *
 * Guru hanya mencadangkan ujian miliknya; ADMIN/TAS seluruhnya. */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const sp = new URL(req.url).searchParams;
    const format = sp.get("format") === "xlsx" ? "xlsx" : "json";
    const examId = sp.get("examId") || undefined;
    const teacherId = await cakupanUjian(session);

    const whereExam = { ...(teacherId ? { teacherId } : {}), ...(examId ? { id: examId } : {}) };
    const [exams, bank, wacana] = await Promise.all([
      prisma.exam.findMany({
        where: whereExam,
        include: {
          class: { select: { name: true } },
          teacher: { select: { user: { select: { name: true } } } },
          kegiatan: { select: { nama: true } },
          questions: { orderBy: { order: "asc" } },
          attempts: { include: { student: { select: { nis: true, user: { select: { name: true } } } } } },
        },
        orderBy: { createdAt: "asc" },
      }),
      examId ? Promise.resolve([]) : prisma.questionBankItem.findMany({
        where: teacherId ? { teacherId } : {},
        include: { teacher: { select: { user: { select: { name: true } } } } },
      }),
      examId ? Promise.resolve([]) : prisma.examStimulus.findMany({ where: teacherId ? { teacherId } : {} }),
    ]);

    const kelas = await petaNamaKelas(exams);
    const stempel = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

    if (format === "json") {
      const isi = {
        versi: 1,
        dibuat: new Date().toISOString(),
        oleh: { nama: session.name, peran: session.role },
        lingkup: examId ? `satu ujian (${examId})` : teacherId ? "ujian milik guru ini" : "seluruh sekolah",
        jumlah: { ujian: exams.length, bankSoal: bank.length, wacana: wacana.length, pengerjaan: exams.reduce((n, e) => n + e.attempts.length, 0) },
        wacana, bankSoal: bank, ujian: exams,
      };
      return new Response(JSON.stringify(isi, null, 2), {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="cadangan-ujian-${stempel}.json"`,
        },
      });
    }

    const barisUjian = exams.map((e, i) => [
      i + 1, e.kegiatan?.nama ?? "", e.title, e.subject, kelas.label(e), e.teacher.user.name, e.token,
      e.questions.length, e.duration,
      new Date(e.startTime).toLocaleString("id-ID"), new Date(e.endTime).toLocaleString("id-ID"),
      e.isPublished ? "Diterbitkan" : "Draft", e.attempts.length,
      e.attempts.filter(a => a.submittedAt).length,
    ]);
    const barisSoal: (string | number)[][] = [];
    for (const e of exams) {
      e.questions.forEach((q, i) => barisSoal.push([
        e.title, i + 1, labelTipe(q.tipe),
        (q.pertanyaan ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
        ((q.opsi as unknown as Opsi[]) ?? []).map(o => `${o.kode}. ${(o.teks ?? "").replace(/<[^>]+>/g, "")}`).join(" | ").slice(0, 500),
        kunciKeTeks({ tipe: q.tipe, opsi: (q.opsi as unknown as Opsi[]) ?? [], kunci: (q.kunci as unknown as Kunci | null) ?? null }),
        (q.kunci as unknown as Kunci | null)?.rubrik ?? "",
        q.skor, q.kd ?? "", q.posisiKunci ?? "",
      ]));
    }
    const barisNilai: (string | number)[][] = [];
    for (const e of exams) {
      e.attempts.forEach(a => barisNilai.push([
        e.title, a.student.nis, a.student.user.name,
        a.submittedAt ? "Selesai" : "Belum", a.score ?? "",
        Array.isArray(a.pelanggaran) ? (a.pelanggaran as unknown[]).length : 0,
        new Date(a.startedAt).toLocaleString("id-ID"),
        a.submittedAt ? new Date(a.submittedAt).toLocaleString("id-ID") : "",
        Object.keys((a.answers as Record<string, Jawaban>) ?? {}).length,
      ]));
    }
    const barisBank = bank.map((b, i) => [
      i + 1, b.subject, labelTipe(b.tipe),
      (b.pertanyaan ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 400),
      kunciKeTeks({ tipe: b.tipe, opsi: (b.opsi as unknown as Opsi[]) ?? [], kunci: (b.kunci as unknown as Kunci | null) ?? null }),
      (b.kunci as unknown as Kunci | null)?.rubrik ?? "",
      b.skor, b.kd ?? "", b.teacher.user.name,
    ]);

    return balasanExcelBanyakSheet(`cadangan-ujian-${stempel}`, [
      { nama: "Daftar Ujian", headers: ["No", "Kegiatan", "Judul", "Mapel", "Kelas", "Guru", "Token", "Soal", "Durasi", "Mulai", "Tutup", "Status", "Peserta", "Selesai"], rows: barisUjian },
      { nama: "Soal & Kunci", headers: ["Ujian", "No", "Jenis", "Pertanyaan", "Pilihan", "Kunci", "Pedoman Penskoran", "Skor", "KD", "LockN"], rows: barisSoal },
      { nama: "Nilai Siswa", headers: ["Ujian", "NIS", "Nama", "Status", "Nilai", "Pelanggaran", "Mulai", "Dikumpulkan", "Soal Dijawab"], rows: barisNilai },
      { nama: "Bank Soal", headers: ["No", "Mapel", "Jenis", "Pertanyaan", "Kunci", "Pedoman Penskoran", "Skor", "KD", "Guru"], rows: barisBank },
    ]);
  } catch {
    return Response.json({ error: "Gagal membuat cadangan." }, { status: 500 });
  }
}
