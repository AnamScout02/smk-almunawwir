import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan } from "@/lib/ujian-server";
import { siapkanSoalUjian } from "@/lib/ujian-pengaturan";
import { acakUntukSiswa, type HasilAcak } from "@/lib/ujian-acak";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { logActivity } from "@/lib/activity-log";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** TAMBAH SOAL SAAT UJIAN BERJALAN (23 September 2026, permintaan user: "tidak bisa tambah soal di daftar ujian?").
 *
 * Mengubah SUSUNAN soal lewat PUT ujian memang ditolak begitu ada yang mengerjakan — jawaban terikat ke id soal dan
 * urutan acak tiap siswa sudah dibekukan di `ExamAttempt.urutan`. Menambah di UJUNG naskah aman asal daftar beku itu
 * ikut diperpanjang, dan itulah yang dilakukan di sini:
 *
 * - Soal baru diletakkan SETELAH soal terakhir (nomor lanjut), tidak menggeser soal lama.
 * - Pengerjaan yang BELUM dikumpulkan: id soal baru ditambahkan ke `urutan.urutanSoal` (+ urutan opsi bila diacak),
 *   sehingga soal itu muncul di layar mereka dan ikut dinilai.
 * - Pengerjaan yang SUDAH dikumpulkan TIDAK disentuh: `nilaiAttempt` hanya menilai soal di `urutanSoal` masing-masing
 *   (`dipakai = urutanSoal.length ? … : soal`), jadi nilai mereka tetap dari soal yang benar-benar mereka kerjakan.
 * - `diperbaruiLiveAt` diisi supaya versi naskah berubah → layar peserta memuat ulang soal sendiri, lalu `kirimSinyal`
 *   mempercepatnya (±1 detik, bukan menunggu denyut 20 detik).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id, { ubah: true });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan atau Anda tidak berhak mengubahnya." }, { status: 404 });

    const body = await req.json().catch(() => ({})) as { questions?: unknown };
    if (!Array.isArray(body.questions) || body.questions.length === 0) {
      return Response.json({ error: "Tidak ada soal yang dikirim." }, { status: 400 });
    }
    const { data: qs, error } = siapkanSoalUjian(body.questions as Parameters<typeof siapkanSoalUjian>[0]);
    if (error) return Response.json({ error }, { status: 400 });

    const terakhir = await prisma.examQuestion.aggregate({ where: { examId: id }, _max: { order: true } });
    const mulai = (terakhir._max.order ?? -1) + 1;
    const sekarang = new Date();

    const dibuat = await prisma.$transaction(
      qs.map((q, i) => prisma.examQuestion.create({
        data: {
          examId: id, tipe: q.tipe, pertanyaan: q.pertanyaan, opsi: q.opsi as object,
          kunci: (q.kunci ?? undefined) as object | undefined, skor: q.skor ?? 1,
          kd: q.kd ?? null, pembahasan: q.pembahasan ?? null, stimulusId: q.stimulusId ?? null,
          materi: q.materi ?? null, indikator: q.indikator ?? null, levelKognitif: q.levelKognitif ?? null,
          order: mulai + i, posisiKunci: null,
          // Menandai naskah berubah → peserta memuat ulang soal (versiSoal di ujian-server.ts).
          diperbaruiLiveAt: sekarang,
        },
        select: { id: true, order: true, tipe: true, opsi: true, stimulusId: true },
      })),
    );

    // Sambungkan ke pengerjaan yang MASIH berjalan saja.
    const berjalan = await prisma.examAttempt.findMany({
      where: { examId: id, submittedAt: null },
      select: { id: true, urutan: true },
    });
    let disambung = 0;
    for (const a of berjalan) {
      const lama = (a.urutan as Partial<HasilAcak> | null) ?? {};
      if (!Array.isArray(lama.urutanSoal) || lama.urutanSoal.length === 0) continue; // belum pernah memuat soal — nanti diacak utuh
      // Benih sama dengan yang dipakai saat urutannya dibuat (paket denah bila ada), supaya pengacakan opsi konsisten.
      const benih = lama.paket ? `${exam.id}:paket:${lama.paket}` : a.id;
      const tambahan = acakUntukSiswa(
        dibuat.map(q => ({
          id: q.id, order: q.order, tipe: q.tipe, stimulusId: q.stimulusId, posisiKunci: null,
          opsi: Array.isArray(q.opsi) ? (q.opsi as { kode: string }[]) : [],
        })),
        { acakSoal: exam.acakSoal, acakOpsi: exam.acakOpsi },
        benih,
      );
      await prisma.examAttempt.update({
        where: { id: a.id },
        data: {
          urutan: {
            ...lama,
            urutanSoal: [...lama.urutanSoal, ...tambahan.urutanSoal],
            urutanOpsi: { ...(lama.urutanOpsi ?? {}), ...tambahan.urutanOpsi },
          } as object,
        },
      });
      disambung += 1;
    }

    await logActivity(session, {
      action: "TAMBAH_SOAL_UJIAN", entity: "Exam", entityId: id,
      description: `Menambah ${dibuat.length} soal pada ujian "${exam.title}" saat berjalan (${disambung} pengerjaan aktif ikut diperbarui)`,
    });
    kirimSinyal(id); // layar peserta memuat ulang naskah ±1 detik

    return Response.json({ ditambah: dibuat.length, pengerjaanDiperbarui: disambung, nomorMulai: mulai + 1 });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menambah soal." }, { status: 500 });
  }
}
