import "server-only";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { prisma } from "@/lib/prisma";
import { ujianDalamCakupan, tenggat, tokenTampilUjian, JEDA_TERPUTUS_MS, filterSiswaPeserta } from "@/lib/ujian-server";
import { sudahDijawab, hitungBelumDikoreksi, type Jawaban } from "@/lib/soal";
import { petaDitahan } from "@/lib/peserta-ditahan";

type UjianDipantau = NonNullable<Awaited<ReturnType<typeof ujianDalamCakupan>>>;
export type PapanPantau = Awaited<ReturnType<typeof susunPapanPantau>>;

/** Isi papan pantau satu ujian. Dipakai GET /api/teacher/exams/[id]/pantau (polling cadangan) dan
 * /pantau/stream (SSE, papan langsung). Tiap siswa kelas peserta: status, kemajuan (terjawab/total yang
 * diterima), ragu-ragu, pelanggaran, denyut terakhir, tambahan waktu, kunci perangkat. Token berjangka
 * ikut diputar di sini karena layar pengawas memang terbuka terus selama ujian. */
export async function susunPapanPantau(exam: UjianDipantau) {
  // SATU token di SEMUA layar (tokenTampilUjian): kegiatan yang punya token bersama memakainya, ujian lepas
  // memakai tokennya sendiri (temuan user 20 September 2026).
  const tampil = await tokenTampilUjian(exam);

  const [siswa, attempts, jumlahSoal] = await Promise.all([
    prisma.student.findMany({
      where: filterSiswaPeserta(exam),
      select: { id: true, nis: true, classId: true, user: { select: { name: true } }, class: { select: { name: true } } },
      orderBy: [{ class: { name: "asc" } }, { user: { name: "asc" } }],
    }),
    prisma.examAttempt.findMany({ where: { examId: exam.id } }),
    prisma.examQuestion.count({ where: { examId: exam.id } }),
  ]);
  const perSiswa = new Map(attempts.map(a => [a.studentId, a]));
  const sekarang = Date.now();
  // Peserta DITAHAN panitia (belum menyelesaikan administrasi) — ditandai di papan supaya pengawas tahu alasannya.
  const tahan = await petaDitahan(exam.kegiatanId);

  const baris = siswa.map(s => {
    const a = perSiswa.get(s.id);
    if (!a) return { student: s, status: "BELUM_MULAI" as const, terjawab: 0, ragu: 0, total: jumlahSoal, pelanggaran: 0, lastSeenAt: null, startedAt: null, submittedAt: null, score: null, sisaDetik: null, tambahanMenit: 0, perangkat: false, alasanKunci: null, menunggu: 0, paket: null as string | null, ditahan: tahan.get(s.id) ?? null };
    const urutan = ((a.urutan as { urutanSoal?: string[] })?.urutanSoal ?? []);
    const total = urutan.length || jumlahSoal;
    const jawaban = (a.answers as Record<string, Jawaban>) ?? {};
    const terjawab = Object.entries(jawaban).filter(([qid, j]) => (!urutan.length || urutan.includes(qid)) && sudahDijawab("", j)).length;
    const pelanggaran = Array.isArray(a.pelanggaran) ? (a.pelanggaran as unknown[]).length : 0;
    const batasWaktu = tenggat(a.startedAt, exam.duration, jendelaKelas(exam, s.classId).endTime, a.tambahanMenit);
    const putus = !a.submittedAt && sekarang - a.lastSeenAt.getTime() > JEDA_TERPUTUS_MS;
    const status = a.submittedAt ? "SELESAI" : a.terkunci ? "TERKUNCI" : sekarang > batasWaktu.getTime() ? "WAKTU_HABIS" : putus ? "TERPUTUS" : "MENGERJAKAN";
    return {
      student: s, status, terjawab, total, pelanggaran,
      ragu: Array.isArray(a.ragu) ? (a.ragu as unknown[]).length : 0,
      lastSeenAt: a.lastSeenAt, startedAt: a.startedAt, submittedAt: a.submittedAt, score: a.score,
      sisaDetik: a.submittedAt ? null : Math.max(0, Math.floor((batasWaktu.getTime() - sekarang) / 1000)),
      tambahanMenit: a.tambahanMenit, perangkat: !!a.perangkatId, alasanKunci: a.alasanKunci,
      menunggu: a.submittedAt ? hitungBelumDikoreksi(a.skorButir) : 0,
      paket: (a.urutan as { paket?: string } | null)?.paket ?? null, // paket menurut denah (src/lib/ujian-acak.ts)
      ditahan: null as string | null,
    };
  });
  const hitung = (st: string) => baris.filter(b => b.status === st).length;
  const ringkas = {
    belum: hitung("BELUM_MULAI"), ditahan: baris.filter(b => b.ditahan).length, mengerjakan: hitung("MENGERJAKAN"), terputus: hitung("TERPUTUS"),
    selesai: hitung("SELESAI"), waktuHabis: hitung("WAKTU_HABIS"), terkunci: hitung("TERKUNCI"),
  };
  return {
    baris, ringkas, jumlahSoal, diperbarui: new Date().toISOString(),
    // `token` = yang DIBACAKAN ke peserta (bersama bila ada). `tokenUjian` tetap dikirim untuk
    // keperluan teknis, tetapi TIDAK ditampilkan bila ada token bersama.
    token: tampil.token,
    tokenUjian: tampil.tokenUjian,
    tokenBersama: tampil.tokenBersama,
    tokenOtomatisMenit: exam.tokenOtomatisMenit,
    tokenBerganti: tampil.tokenBerganti,
  };
}

/** Sidik isi papan TANPA bagian yang bergerak sendiri tiap detik (sisaDetik, denyut, jam diperbarui) —
 * stream hanya mengirim ulang papan kalau sidik ini berubah (atau sudah lama tidak mengirim). Sisa waktu
 * dihitung mundur di browser dari kiriman terakhir. */
export function sidikPapan(p: PapanPantau) {
  return JSON.stringify([
    p.ringkas, p.jumlahSoal, p.token, p.tokenBerganti,
    p.baris.map(b => [b.student.id, b.status, b.terjawab, b.total, b.ragu, b.pelanggaran, b.tambahanMenit, b.perangkat, b.alasanKunci, b.menunggu, b.score, b.submittedAt, b.ditahan]),
  ]);
}
