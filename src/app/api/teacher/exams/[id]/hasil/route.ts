import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, kelasPeserta } from "@/lib/ujian-server";
import { balasanExcelBanyakSheet } from "@/lib/ekspor-excel";
import { hitungBelumDikoreksi } from "@/lib/soal";
import { hitungAnalisisButir } from "@/lib/analisis-butir";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Hasil ujian + analisis butir. `?format=xlsx` mengunduh Excel (Rekap, Per Butir, Analisis). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const format = new URL(req.url).searchParams.get("format");

    const [soal, attempts, kelas] = await Promise.all([
      prisma.examQuestion.findMany({ where: { examId: id }, orderBy: { order: "asc" } }),
      prisma.examAttempt.findMany({
        where: { examId: id },
        include: { student: { select: { id: true, nis: true, user: { select: { name: true } }, class: { select: { name: true } } } } },
        orderBy: [{ student: { class: { name: "asc" } } }, { student: { user: { name: "asc" } } }],
      }),
      prisma.class.findMany({ where: { id: { in: kelasPeserta(exam) } }, select: { name: true }, orderBy: { name: "asc" } }),
    ]);

    const { rekap, selesai, analisis, statistik } = hitungAnalisisButir(soal, attempts);

    if (format !== "xlsx") {
      return Response.json({
        exam: { id: exam.id, title: exam.title, subject: exam.subject, kelas: kelas.map(k => k.name).join(", "), tampilkanNilai: exam.tampilkanNilai },
        statistik, analisis,
        rekap: rekap.map(r => ({ student: r.student, score: r.score, submittedAt: r.submittedAt, pelanggaran: r.pelanggaran, menunggu: r.submittedAt ? hitungBelumDikoreksi(r.skorButir) : 0 })),
      });
    }

    const rekapRows = rekap.map((r, i) => [i + 1, r.student.nis, r.student.user.name, r.student.class?.name ?? "",
      r.submittedAt ? (hitungBelumDikoreksi(r.skorButir) > 0 ? "Selesai (nilai sementara)" : "Selesai") : "Belum", r.score ?? "", r.pelanggaran,
      r.submittedAt ? new Date(r.submittedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" }) : ""]);
    const butirRows = rekap.filter(r => r.submittedAt).map((r, i) => [
      i + 1, r.student.nis, r.student.user.name, r.student.class?.name ?? "",
      ...soal.map(q => (r.urutan.length && !r.urutan.includes(q.id)) ? "-" : (r.skorButir[q.id] ?? 0)),
      r.score ?? "",
    ]);
    const analisisRows = analisis.map(a => [a.nomor, a.tipe, a.kd ?? "", a.skor, a.kunci, a.peserta, a.benar,
      a.kesukaran === null ? "" : Math.round(a.kesukaran * 100) / 100, a.kategoriKesukaran,
      a.dayaBeda === null ? "" : Math.round(a.dayaBeda * 100) / 100, a.kategoriDayaBeda, a.rataWaktu ?? "", a.rataUbah ?? ""]);
    const waktuRows = rekap.filter(r => r.submittedAt).map((r, i) => [
      i + 1, r.student.nis, r.student.user.name, r.student.class?.name ?? "",
      ...soal.map(q => (r.urutan.length && !r.urutan.includes(q.id)) ? "-" : (r.waktuSoal[q.id] ?? "")),
      Object.values(r.waktuSoal).reduce((n, d) => n + d, 0),
    ]);
    const pengecohRows = analisis.flatMap(a => a.sebaran.map(o => [
      a.nomor, o.kode, o.teks, o.benar ? "KUNCI" : "", o.dipilih, o.persen,
      o.berfungsi === null ? "" : o.berfungsi ? "Berfungsi" : "Tidak berfungsi", a.kosong,
    ]));
    return balasanExcelBanyakSheet(`hasil-${exam.title.replace(/[^\w]+/g, "-").toLowerCase()}`, [
      { nama: "Rekap Nilai", headers: ["No", "NIS", "Nama", "Kelas", "Status", "Nilai", "Pelanggaran", "Dikumpulkan"], rows: rekapRows },
      { nama: "Skor per Butir", headers: ["No", "NIS", "Nama", "Kelas", ...soal.map(q => `S${q.order + 1}`), "Nilai"], rows: butirRows },
      { nama: "Analisis Butir", headers: ["No", "Tipe", "KD", "Skor", "Kunci", "Peserta", "Benar", "Kesukaran", "Kategori", "Daya Beda", "Kategori", "Rata Waktu (detik)", "Rata Ganti Jawaban"], rows: analisisRows },
      { nama: "Analisis Pengecoh", headers: ["No Soal", "Opsi", "Teks Opsi", "Kunci", "Dipilih", "Persen", "Pengecoh", "Tidak Menjawab"], rows: pengecohRows },
      { nama: "Waktu per Soal", headers: ["No", "NIS", "Nama", "Kelas", ...soal.map(q => `S${q.order + 1} (dtk)`), "Total (dtk)"], rows: waktuRows },
    ]);
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal memuat hasil." }, { status: 500 });
  }
}
