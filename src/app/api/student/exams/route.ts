import { prisma } from "@/lib/prisma";
import { kegiatanDitahanSiswa } from "@/lib/peserta-ditahan";
import { verifyRole } from "@/lib/dal";
import { siswaDariSesi, ujianUntukSiswa } from "@/lib/ujian-server";
import { hitungBelumDikoreksi } from "@/lib/soal";
import { jendelaKelas } from "@/lib/jadwal-ujian-kelas";

export const dynamic = "force-dynamic";

/** BERANDA PESERTA UJIAN — daftar ujian yang boleh diikuti siswa ini hari ini, plus riwayat
 * ujian yang sudah selesai. Tidak pernah membuat attempt: membuka beranda BUKAN "masuk ujian",
 * jam baru berjalan setelah siswa menegaskan di halaman konfirmasi. */
export async function GET() {
  try {
    const session = await verifyRole(["STUDENT"]);
    const student = await siswaDariSesi(session);
    if (!student?.classId) {
      return Response.json({ error: "Akun Anda belum terhubung ke kelas. Hubungi Tata Usaha." }, { status: 403 });
    }

    const now = new Date();
    const akhirHari = new Date(now); akhirHari.setHours(23, 59, 59, 999);

    const [profil, exams] = await Promise.all([
      prisma.student.findUnique({
        where: { id: student.id },
        select: { nis: true, nisn: true, user: { select: { name: true, avatar: true } }, class: { select: { name: true } } },
      }),
      prisma.exam.findMany({
        where: { ...ujianUntukSiswa(student.classId, student.id), isPublished: true },
        include: {
          teacher: { select: { user: { select: { name: true } } } },
          kegiatan: { select: { nama: true, singkatan: true } },
          _count: { select: { questions: true } },
          attempts: { where: { studentId: student.id }, select: { startedAt: true, submittedAt: true, score: true, skorButir: true } },
        },
        orderBy: { startTime: "asc" },
      }),
    ]);

    const ditahanDi = await kegiatanDitahanSiswa(student.id); // src/lib/peserta-ditahan.ts
    const aktif = [], riwayat = [];
    for (const e of exams) {
      const a = e.attempts[0] ?? null;
      const jendela = jendelaKelas(e, student.classId); // jam kelas siswa ini (kegiatan per kelas)
      const mulai = jendela.startTime.getTime(), tutup = jendela.endTime.getTime();
      const dasar = {
        id: e.id, judul: e.title, mapel: e.subject, guru: e.teacher.user.name, durasi: e.duration,
        kegiatan: e.kegiatan,
        mulai: jendela.startTime.toISOString(), tutup: jendela.endTime.toISOString(),
        jumlahSoal: e.jumlahDikerjakan && e.jumlahDikerjakan < e._count.questions ? e.jumlahDikerjakan : e._count.questions,
        sudahMulai: !!a, sudahSelesai: !!a?.submittedAt,
        ditahan: !a && e.kegiatanId ? ditahanDi.get(e.kegiatanId) ?? null : null,
      };
      if (a?.submittedAt || tutup < now.getTime()) {
        riwayat.push({
          ...dasar,
          dikumpulkan: a?.submittedAt ? a.submittedAt.toISOString() : null,
          // Nilai hanya ikut kalau guru mengizinkan — kalau tidak, siswa cuma melihat "Selesai".
          nilai: e.tampilkanNilai ? a?.score ?? null : null,
          sementara: e.tampilkanNilai && !!a?.submittedAt && hitungBelumDikoreksi(a.skorButir) > 0,
          bolehLihatNilai: e.tampilkanNilai,
        });
      } else if (mulai <= akhirHari.getTime()) {
        // Tampil sejak hari-H (bukan berminggu-minggu sebelumnya) sampai jam tutupnya lewat.
        aktif.push({ ...dasar, status: now.getTime() < mulai ? "AKAN_DATANG" : "BERLANGSUNG" });
      }
    }
    riwayat.reverse();

    return Response.json({
      siswa: {
        nama: profil?.user.name ?? session.name, nis: profil?.nis ?? "", nisn: profil?.nisn ?? "",
        kelas: profil?.class?.name ?? "-", avatar: profil?.user.avatar ?? null,
      },
      aktif, riwayat, serverNow: now.toISOString(),
    });
  } catch {
    return Response.json({ error: "Gagal memuat daftar ujian." }, { status: 500 });
  }
}
