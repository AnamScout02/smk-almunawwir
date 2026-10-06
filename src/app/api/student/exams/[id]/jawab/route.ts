import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { rekamanMilikSendiri } from "@/lib/ujian-lisan";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, tenggat, TOLERANSI_MS, BATAS_SUSULAN_MS, versiSoal, jagaAttempt, tambahJejak, HEADER_PERANGKAT, ujianUntukKelas } from "@/lib/ujian-server";
import { type Jawaban } from "@/lib/soal";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Simpan SATU jawaban (autosave) sekaligus denyut. Ditolak setelah tenggat + toleransi, KECUALI jawaban susulan
 * (`dibuat` sebelum tenggat, tertahan di perangkat karena koneksi putus — BATAS_SUSULAN_MS).
 * Body: { questionId, jawaban } — jawaban boleh null untuk menghapus.
 *   atau { questionId, ragu: true|false } — hanya menandai/melepas tanda ragu-ragu.
 * Klien mengirim ulang jawaban yang tertunda saat koneksi putus (antrean luring), jadi route ini
 * harus aman dipanggil berkali-kali dengan isi yang sama. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json() as { questionId: string; jawaban?: Jawaban; ragu?: boolean; dibuat?: number };
    const { questionId } = body;

    const [exam, attempt] = await Promise.all([
      prisma.exam.findFirst({ where: { id, ...ujianUntukKelas(student.classId), isPublished: true }, select: { duration: true, startTime: true, endTime: true, jadwalKelas: true } }),
      prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } }),
    ]);
    if (!exam || !attempt) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    if (attempt.submittedAt) return Response.json({ error: "Ujian sudah dikumpulkan.", selesai: true }, { status: 400 });
    const jaga = await jagaAttempt(attempt, req.headers.get(HEADER_PERANGKAT));
    if (jaga.tolak) return jaga.tolak;

    const batas = tenggat(attempt.startedAt, exam.duration, jendelaKelas(exam, student.classId).endTime, attempt.tambahanMenit).getTime();
    // Lewat tenggat: hanya JAWABAN SUSULAN yang diterima — dibuat sebelum waktu habis, tertahan di perangkat karena
    // koneksi putus (BATAS_SUSULAN_MS di ujian-server.ts). Selain itu ditolak permanen (`habis`): klien membuangnya dari
    // antrean lalu mengumpulkan, bukan menunggu selamanya.
    const sekarang = Date.now();
    let susulan = false;
    if (sekarang > batas + TOLERANSI_MS) {
      const dibuat = Number(body.dibuat);
      const sah = Number.isFinite(dibuat) && dibuat >= attempt.startedAt.getTime() && dibuat <= batas + TOLERANSI_MS
        && sekarang <= batas + BATAS_SUSULAN_MS;
      if (!sah) return Response.json({ error: "Waktu ujian sudah habis.", habis: true }, { status: 403 });
      susulan = true;
    }

    const jamWib = (t: number) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" });
    const catatSusulan = () => susulan
      ? { jejak: tambahJejak(jaga.jejak, { jenis: "JAWABAN_SUSULAN", ket: `dibuat ${jamWib(Number(body.dibuat))}, tiba ${jamWib(sekarang)} (tertahan koneksi putus)` }) as object }
      : {};

    // Hanya soal yang memang diterima siswa ini (menurut urutan) yang boleh dijawab.
    const urutan = ((attempt.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []);
    if (urutan.length && !urutan.includes(questionId)) return Response.json({ error: "Soal tidak dikenal." }, { status: 400 });

    if (typeof body.ragu === "boolean") {
      const ragu = new Set(Array.isArray(attempt.ragu) ? (attempt.ragu as string[]) : []);
      if (body.ragu) ragu.add(questionId); else ragu.delete(questionId);
      await prisma.examAttempt.update({ where: { id: attempt.id }, data: { ragu: [...ragu], lastSeenAt: new Date(), ...catatSusulan() } });
    } else {
      const answers = { ...((attempt.answers as Record<string, Jawaban>) ?? {}) };
      const sebelum = answers[questionId];
      const j = body.jawaban;
      // Jawaban lisan = alamat rekaman; hanya rekaman milik pengerjaan ini yang diterima (src/lib/ujian-lisan.ts).
      if (!rekamanMilikSendiri(j, id, attempt.id)) return Response.json({ error: "Rekaman tidak dikenal." }, { status: 400 });
      if (j === null || j === undefined || j === "") delete answers[questionId];
      // Batas ukuran: teks 20.000 huruf; daftar (titik gambar, urutan) & objek (seret-lepas, menjodohkan) maks 100 isi.
      else answers[questionId] = typeof j === "string" ? j.slice(0, 20000)
        : Array.isArray(j) ? j.slice(0, 100).map(x => String(x).slice(0, 60))
        : j && typeof j === "object" ? Object.fromEntries(Object.entries(j as Record<string, unknown>).slice(0, 100).map(([k, v]) => [k.slice(0, 20), typeof v === "boolean" ? v : String(v).slice(0, 60)]))
        : j;
      // Hitung PENGGANTIAN jawaban (jawaban pertama tidak dihitung; kiriman ulang yang sama dari
      // antrean luring juga tidak) — dipakai analisis "soal yang paling sering diubah jawabannya".
      // Soal isian/uraian yang diketik tidak dihitung: tiap ketikan tersimpan sebagai perubahan.
      const pilihan = !(typeof answers[questionId] === "string" && String(answers[questionId]).length > 3);
      const berubah = pilihan && sebelum !== undefined && JSON.stringify(sebelum) !== JSON.stringify(answers[questionId] ?? null);
      const ubahJawaban = { ...((attempt.ubahJawaban as Record<string, number>) ?? {}) };
      if (berubah) ubahJawaban[questionId] = (ubahJawaban[questionId] ?? 0) + 1;
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: { answers: answers as object, lastSeenAt: new Date(), ...(berubah ? { ubahJawaban } : {}), ...catatSusulan() },
      });
    }
    return Response.json({
      ok: true, sisaDetik: Math.max(0, Math.floor((batas - Date.now()) / 1000)),
      deadline: new Date(batas).toISOString(), versiSoal: await versiSoal(id),
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyimpan jawaban." }, { status: 500 });
  }
}
