import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { pesanUntukSiswa } from "@/lib/pesan-ujian";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, tenggat, versiSoal, jagaAttempt, tambahJejak, HEADER_PERANGKAT, ujianUntukKelas } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** DENYUT halaman ujian — dipanggil tiap ±20 detik selama siswa mengerjakan.
 *
 * Tiga gunanya:
 *   1. Papan pantau tahu siswa masih di layar walau sedang lama berpikir tanpa menjawab
 *      (dulu siswa seperti ini tampil "Terputus" setelah 90 detik).
 *   2. Tenggat TERBARU dikirim balik, jadi Tambah/Reset Waktu dari pengawas langsung sampai ke
 *      jam di layar siswa tanpa memuat ulang halaman.
 *   3. Kunci perangkat, kunci pengawas, dan versi soal (edit live) ikut diperiksa.
 *   4. Pesan pengawas ("Sisa 10 menit", "Ralat soal no. 5") ikut terbawa — lihat src/lib/pesan-ujian.ts.
 * Body opsional:
 *   { putusDetik } saat koneksi baru pulih — dicatat di jejak aktivitas.
 *   { waktu: { [questionId]: detik } } — lama siswa di tiap soal SEJAK denyut terakhir (ditambahkan,
 *   bukan ditimpa; klien menahan sisanya kalau denyut gagal terkirim). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = await req.json().catch(() => ({})) as { putusDetik?: number; waktu?: Record<string, number> };

    const [exam, attempt] = await Promise.all([
      prisma.exam.findFirst({ where: { id, ...ujianUntukKelas(student.classId), isPublished: true }, select: { duration: true, startTime: true, endTime: true, jadwalKelas: true } }),
      prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } } }),
    ]);
    if (!exam || !attempt) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    if (attempt.submittedAt) return Response.json({ ok: true, submitted: true });
    const jaga = await jagaAttempt(attempt, req.headers.get(HEADER_PERANGKAT));
    if (jaga.tolak) return jaga.tolak;

    const putus = Math.round(Number(body.putusDetik) || 0);
    const urutanIds = ((attempt.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []);
    const waktuSoal = { ...((attempt.waktuSoal as Record<string, number>) ?? {}) };
    let adaWaktu = false;
    for (const [qid, dtk] of Object.entries(body.waktu ?? {})) {
      const n = Math.round(Number(dtk));
      // Batas wajar per kiriman: denyut tiap 20 detik, jadi >15 menit berarti data aneh — abaikan.
      if (!Number.isFinite(n) || n <= 0 || n > 900) continue;
      if (urutanIds.length && !urutanIds.includes(qid)) continue;
      waktuSoal[qid] = (waktuSoal[qid] ?? 0) + n;
      adaWaktu = true;
    }
    await prisma.examAttempt.update({
      where: { id: attempt.id },
      data: {
        lastSeenAt: new Date(),
        ...(adaWaktu ? { waktuSoal } : {}),
        ...(putus >= 10 ? { jejak: tambahJejak(jaga.jejak, { jenis: "SAMBUNG_KEMBALI", ket: `terputus ${putus} detik` }) as object } : {}),
      },
    });
    const batas = tenggat(attempt.startedAt, exam.duration, jendelaKelas(exam, student.classId).endTime, attempt.tambahanMenit);
    return Response.json({
      ok: true, submitted: false, deadline: batas.toISOString(), serverNow: new Date().toISOString(),
      sisaDetik: Math.max(0, Math.floor((batas.getTime() - Date.now()) / 1000)), versiSoal: await versiSoal(id),
      waktuDiterima: adaWaktu,
      pesan: await pesanUntukSiswa(id, student), // pesan pengawas (src/lib/pesan-ujian.ts)
    });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal." }, { status: 500 });
  }
}
