import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";
import { verifyRole } from "@/lib/dal";
import { ujianDalamCakupan, simpanNilaiAttempt, tenggat, tambahanUntukSisa, tambahJejak, JEDA_TERPUTUS_MS } from "@/lib/ujian-server";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/** Tindakan MASSAL satu ujian - dipakai saat listrik padam, jaringan putus, atau ujian harus
 * ditutup serentak:
 *   "tambah-waktu"      : semua yang belum mengumpulkan dapat tambahan menit.
 *   "kumpulkan-semua"   : semua yang belum mengumpulkan ditutup & dinilai sekarang.
 *   "buka-terputus"     : yang terputus / waktu habis / terkunci diberi waktu lagi & dibuka.
 *   "buka-kunci-semua"  : buka semua pengerjaan yang terkunci.
 * Tambahan waktu disimpan PER SISWA (`tambahanMenit`), jadi jam tutup ujian tidak perlu digeser. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id);
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const { aksi, menit } = await req.json();
    const tambah = Math.min(240, Math.max(1, Number(menit) || 15));
    const sekarang = Date.now();
    const oleh = session.name;

    const attempts = await prisma.examAttempt.findMany({ where: { examId: id, submittedAt: null }, include: { student: { select: { classId: true } } } });
    // Jam tutup mengikuti KELAS siswa (kegiatan per kelas memakai jam berbeda per kelas).
    const kelasUjian = (a: typeof attempts[number]) => ({ duration: exam.duration, endTime: jendelaKelas(exam, a.student.classId).endTime });
    const sisa = (a: typeof attempts[number]) => Math.max(0, (tenggat(a.startedAt, exam.duration, kelasUjian(a).endTime, a.tambahanMenit).getTime() - sekarang) / 60_000);

    if (aksi === "kumpulkan-semua") {
      for (const a of attempts) {
        await prisma.examAttempt.update({ where: { id: a.id }, data: { submittedAt: new Date(), jejak: tambahJejak(a.jejak, { jenis: "KUMPUL_PAKSA", ket: "massal", oleh }) as object } });
        await simpanNilaiAttempt(a.id);
      }
      kirimSinyal(id); return Response.json({ ok: true, jumlah: attempts.length, pesan: `${attempts.length} pengerjaan ditutup & dinilai.` });
    }

    if (aksi === "buka-kunci-semua") {
      const sasaran = attempts.filter(a => a.terkunci);
      for (const a of sasaran) {
        await prisma.examAttempt.update({ where: { id: a.id }, data: { terkunci: false, alasanKunci: null, lastSeenAt: new Date(), jejak: tambahJejak(a.jejak, { jenis: "BUKA_KUNCI", ket: "massal", oleh }) as object } });
      }
      kirimSinyal(id); return Response.json({ ok: true, jumlah: sasaran.length, pesan: `${sasaran.length} pengerjaan dibuka kuncinya.` });
    }

    const sasaran = aksi === "buka-terputus"
      ? attempts.filter(a => a.terkunci || sisa(a) <= 0 || sekarang - a.lastSeenAt.getTime() > JEDA_TERPUTUS_MS)
      : attempts;
    for (const a of sasaran) {
      const target = aksi === "buka-terputus" ? Math.max(sisa(a), tambah) : sisa(a) + tambah;
      await prisma.examAttempt.update({
        where: { id: a.id },
        data: {
          tambahanMenit: tambahanUntukSisa(a, kelasUjian(a), target, sekarang), terkunci: false, alasanKunci: null,
          lastSeenAt: new Date(), dilanjutkanOleh: session.userId,
          jejak: tambahJejak(a.jejak, { jenis: aksi === "buka-terputus" ? "BUKA_TERPUTUS" : "TAMBAH_WAKTU", ket: `massal +${tambah} menit`, oleh }) as object,
        },
      });
    }
    kirimSinyal(id); return Response.json({ ok: true, jumlah: sasaran.length, pesan: `${sasaran.length} siswa diberi tambahan ${tambah} menit.` });
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menjalankan tindakan massal." }, { status: 500 });
  }
}
