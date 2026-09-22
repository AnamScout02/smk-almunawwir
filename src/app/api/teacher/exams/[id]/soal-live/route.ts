import { prisma } from "@/lib/prisma";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, simpanNilaiAttempt } from "@/lib/ujian-server";
import { siapkanButir } from "@/lib/soal-butir-server";
import { logActivity } from "@/lib/activity-log";
import { type Opsi, type Kunci } from "@/lib/soal";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const kodeUrut = (xs: { kode: string }[]) => xs.map(x => x.kode).sort().join("|");

/** EDIT SOAL LIVE — memperbaiki satu soal SAAT ujian sudah/sedang dikerjakan, tanpa merusak
 * pengerjaan peserta.
 *
 * Kenapa aman: jawaban & urutan acak tiap peserta dikunci pada ID SOAL dan KODE PILIHAN. Selama
 * keduanya tidak berubah, perbaikan teks, gambar, kunci, dan skor tidak menggeser apa pun. Maka
 * yang DITOLAK hanya perubahan yang menggeser kunci-kunci itu:
 *   - mengganti jenis soal,
 *   - menambah/menghapus pilihan (atau butir kiri/pilihan kanan pada Menjodohkan).
 * Menambah/menghapus soal utuh juga tidak lewat sini — urutan soal tiap peserta sudah dibagikan.
 *
 * Kalau kunci atau skor berubah, SEMUA pengerjaan yang sudah dikumpulkan langsung dinilai ulang.
 * Peserta yang sedang mengerjakan menerima soal terbaru pada simpan-otomatis berikutnya
 * (lihat `versiSoal` di route jawab), dengan catatan "soal ini diperbaiki pengawas". */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id, { ubah: true });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan." }, { status: 404 });

    const b = await req.json();
    const q = await prisma.examQuestion.findFirst({ where: { id: String(b.questionId ?? ""), examId: id } });
    if (!q) return Response.json({ error: "Soal tidak ditemukan pada ujian ini." }, { status: 404 });

    /* ---- BATALKAN SOAL (20 September 2026) ----
     * Menghapus BARIS soal saat ujian berjalan merusak pekerjaan peserta: urutan acak dan jawaban
     * mereka terikat pada ID soal. Yang benar adalah MEMBATALKAN penilaiannya: skor dijadikan 0,
     * sehingga butir itu tidak menambah perolehan MAUPUN pembagi (`maksimum += s.skor` di
     * nilaiAttempt). Soal tetap terlihat, tidak ada yang dirugikan, dan semua nilai dihitung ulang.
     * Guru yang menemukan soal cacat di tengah ujian butuh ini — bukan tombol hapus. */
    if (b.aksi === "batalkan") {
      const attempts = await prisma.examAttempt.findMany({ where: { examId: id }, select: { id: true, skorButir: true } });
      await prisma.$transaction([
        prisma.examQuestion.update({ where: { id: q.id }, data: { skor: 0, diperbaruiLiveAt: new Date() } }),
        // Skor butir dijadikan 0 supaya soal uraian yang dibatalkan tidak terus dihitung "menunggu koreksi".
        ...attempts.map(a => prisma.examAttempt.update({
          where: { id: a.id },
          data: { skorButir: { ...((a.skorButir as Record<string, number | null>) ?? {}), [q.id]: 0 } as object },
        })),
      ]);
      for (const a of attempts) await simpanNilaiAttempt(a.id).catch(() => null);
      await logActivity(session, {
        action: "BATALKAN_SOAL_UJIAN", entity: "Exam", entityId: id,
        description: `Membatalkan penilaian soal nomor ${q.order + 1} — nilai ${attempts.length} peserta dihitung ulang`,
      }).catch(() => {});
      kirimSinyal(id);
      return Response.json({ ok: true, pesan: `Soal nomor ${q.order + 1} dibatalkan — tidak dihitung, nilai semua peserta diperbarui.` });
    }

    const opsiLama = (Array.isArray(q.opsi) ? q.opsi : []) as unknown as Opsi[];
    const kunciLama = (q.kunci ?? null) as Kunci | null;
    const { data, error } = siapkanButir({
      tipe: q.tipe, // jenis soal TIDAK boleh berubah saat live
      pertanyaan: b.pertanyaan, opsi: b.opsi, kunci: b.kunci ?? null,
      skor: b.skor, kd: b.kd, pembahasan: b.pembahasan, stimulusId: q.stimulusId,
    });
    if (error) return Response.json({ error }, { status: 400 });

    if (kodeUrut(data.opsi) !== kodeUrut(opsiLama)) {
      return Response.json({ error: "Saat ujian berjalan, pilihan jawaban tidak boleh ditambah atau dihapus — cukup perbaiki teksnya atau kuncinya." }, { status: 409 });
    }
    if (q.tipe === "MENJODOHKAN" && kodeUrut(data.kunci?.kanan ?? []) !== kodeUrut(kunciLama?.kanan ?? [])) {
      return Response.json({ error: "Saat ujian berjalan, pilihan kanan tidak boleh ditambah atau dihapus." }, { status: 409 });
    }
    // Titik pada gambar: jawaban siswa = daftar titik sebanyak area — jumlah area terikat pada lembar yang sudah dikerjakan.
    if ((q.tipe === "TITIK_GAMBAR" || q.tipe === "SERET_LEPAS") && kodeUrut(data.kunci?.area ?? []) !== kodeUrut(kunciLama?.area ?? [])) {
      return Response.json({ error: "Saat ujian berjalan, area pada gambar tidak boleh ditambah atau dihapus — cukup geser atau ubah ukurannya." }, { status: 409 });
    }

    const skorBaru = Math.max(0, Math.round(Number(data.skor) || 0));
    const benarLama = opsiLama.filter(o => o.benar).map(o => o.kode).sort().join("|");
    const benarBaru = data.opsi.filter(o => o.benar).map(o => o.kode).sort().join("|");
    const penilaianBerubah = skorBaru !== q.skor || benarLama !== benarBaru
      || JSON.stringify(data.kunci ?? null) !== JSON.stringify(kunciLama);

    const jumlahPengerjaan = await prisma.examAttempt.count({ where: { examId: id } });
    await prisma.examQuestion.update({
      where: { id: q.id },
      data: {
        pertanyaan: data.pertanyaan, opsi: data.opsi as object,
        kunci: (data.kunci ?? undefined) as object | undefined,
        skor: skorBaru, kd: data.kd ?? null, pembahasan: data.pembahasan ?? null,
        ...(jumlahPengerjaan > 0 ? { diperbaruiLiveAt: new Date() } : {}),
      },
    });

    // Nilai ulang pengerjaan yang sudah dikumpulkan — satu per satu, memakai penilai yang sama
    // dengan saat siswa mengumpulkan, jadi hasilnya identik dengan kalau kuncinya benar sejak awal.
    let dinilaiUlang = 0, nilaiBerubah = 0;
    if (penilaianBerubah) {
      const selesai = await prisma.examAttempt.findMany({ where: { examId: id, submittedAt: { not: null } }, select: { id: true, score: true } });
      for (const a of selesai) {
        const h = await simpanNilaiAttempt(a.id);
        dinilaiUlang += 1;
        if (h && h.nilai !== a.score) nilaiBerubah += 1;
      }
    }

    const nomor = (await prisma.examQuestion.count({ where: { examId: id, order: { lt: q.order } } })) + 1;
    await logActivity(session, {
      action: "EDIT_SOAL_LIVE", entity: "ExamQuestion", entityId: q.id,
      description: `Memperbaiki soal no. ${nomor} pada ujian "${exam.title}"${penilaianBerubah ? ` (kunci/skor berubah, ${dinilaiUlang} pengerjaan dinilai ulang)` : ""}`,
      metadata: { examId: id, penilaianBerubah, dinilaiUlang, nilaiBerubah, skorLama: q.skor, skorBaru, kunciLama: benarLama, kunciBaru: benarBaru },
    });

    kirimSinyal(id); // layar peserta memuat ulang isi soal lewat versiSoal di denyut
    return Response.json({
      ok: true, penilaianBerubah, dinilaiUlang, nilaiBerubah,
      pesan: penilaianBerubah
        ? `Soal no. ${nomor} diperbaiki. ${dinilaiUlang} pengerjaan yang sudah dikumpulkan dinilai ulang${nilaiBerubah ? ` — ${nilaiBerubah} nilai berubah` : ""}.`
        : `Soal no. ${nomor} diperbaiki. Layar peserta yang sedang mengerjakan diperbarui dalam beberapa detik.`,
    });
  } catch {
    return Response.json({ error: "Gagal memperbaiki soal." }, { status: 500 });
  }
}
