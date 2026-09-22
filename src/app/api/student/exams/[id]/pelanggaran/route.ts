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
    const daftar = Array.isArray(attempt.pelanggaran) ? (attempt.pelanggaran as { jenis: string; waktu: string }[]) : [];
    daftar.push({ jenis, waktu: new Date().toISOString() });
    await prisma.examAttempt.update({ where: { id: attempt.id }, data: { pelanggaran: daftar as object, lastSeenAt: new Date() } });
    const pindah = daftar.filter(p => p.jenis === "PINDAH_TAB").length;
    const batas = attempt.exam.batasPindahTab;
    const melebihi = batas > 0 && pindah > batas;
    if (melebihi && !attempt.terkunci) {
      await prisma.examAttempt.update({
        where: { id: attempt.id },
        data: {
          terkunci: true,
          alasanKunci: `Keluar dari layar ujian ${pindah} kali (batas ${batas}). Pengerjaan dikunci otomatis — minta pengawas membuka kembali.`,
        },
      });
    }
    return Response.json({ ok: true, jumlah: daftar.length, pindahTab: pindah, melebihiBatas: melebihi, terkunci: melebihi, batas });
  } catch {
    return Response.json({ error: "Gagal mencatat." }, { status: 500 });
  }
}
