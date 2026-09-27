import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const JENIS_SAH = new Set(["PINDAH_TAB", "KELUAR_LAYAR_PENUH", "SALIN", "KLIK_KANAN", "PRINT_SCREEN", "PINTASAN"]);

/** Catat pelanggaran dari halaman ujian (pindah tab, keluar layar penuh, dsb).
 *
 * SEJAK 20 September 2026 (permintaan user: "ketika melewati pindah aplikasi yang ditentukan,
 * langsung logout dan minta di-reset login"): begitu `batasPindahTab` TERLAMPAUI, pengerjaan
 * LANGSUNG DIKUNCI di server — siswa terlempar ke layar terkunci dan baru bisa lanjut setelah
 * pengawas menekan Reset Login / Buka Kunci di papan pantau. Jawaban yang sudah masuk tetap aman.
 * `batasPindahTab = 0` berarti tidak dibatasi: pelanggaran tetap dicatat, tidak mengunci. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const { jenis } = await req.json();
    if (!JENIS_SAH.has(jenis)) return Response.json({ error: "Jenis tidak dikenal" }, { status: 400 });
    const attempt = await prisma.examAttempt.findUnique({ where: { examId_studentId: { examId: id, studentId: student.id } }, include: { exam: { select: { batasPindahTab: true } } } });
    if (!attempt || attempt.submittedAt) return Response.json({ ok: true });
    const batas = attempt.exam.batasPindahTab;

    // Baris DIKUNCI selama diperbarui (`FOR UPDATE`). Sebelumnya daftar dibaca, ditambah, lalu ditulis
    // utuh tanpa penguncian — dua catatan yang datang hampir bersamaan saling menimpa dan jumlahnya
    // bisa TURUN (temuan user 23 Sep 2026: "pelanggaran 5 tapi kok berkurang jadi 4").
    const hasil = await prisma.$transaction(async (tx) => {
      const baris = await tx.$queryRaw<{ pelanggaran: unknown; terkunci: boolean }[]>`
        SELECT "pelanggaran", "terkunci" FROM "ExamAttempt" WHERE id = ${attempt.id} FOR UPDATE`;
      const daftar = Array.isArray(baris[0]?.pelanggaran) ? (baris[0].pelanggaran as { jenis: string; waktu: string }[]) : [];
      // SATU kejadian nyata sering memicu dua laporan sekaligus (keluar layar → `visibilitychange` +
      // `blur`; pintasan → `keydown` + `keyup`), sehingga satu pelanggaran terhitung dua kali. Laporan
      // berjenis sama dalam 2 detik dianggap kejadian yang sama.
      const terakhir = [...daftar].reverse().find(p => p.jenis === jenis);
      const kembar = !!terakhir && Date.now() - new Date(terakhir.waktu).getTime() < 2000;
      if (!kembar) daftar.push({ jenis, waktu: new Date().toISOString() });
      const pindah = daftar.filter(p => p.jenis === "PINDAH_TAB").length;
      const melebihi = batas > 0 && pindah > batas;
      await tx.examAttempt.update({
        where: { id: attempt.id },
        data: {
          pelanggaran: daftar as object,
          lastSeenAt: new Date(),
          ...(melebihi && !baris[0]?.terkunci
            ? { terkunci: true, alasanKunci: `Keluar dari layar ujian ${pindah} kali (batas ${batas}). Pengerjaan dikunci otomatis — minta pengawas membuka kembali.` }
            : {}),
        },
      });
      return { jumlah: daftar.length, pindah, melebihi };
    });

    return Response.json({ ok: true, jumlah: hasil.jumlah, pindahTab: hasil.pindah, melebihiBatas: hasil.melebihi, terkunci: hasil.melebihi, batas });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal mencatat." }, { status: 500 });
  }
}
