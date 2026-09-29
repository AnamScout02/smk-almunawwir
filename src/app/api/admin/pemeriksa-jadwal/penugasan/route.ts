import { NextResponse } from "next/server";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { lemparBilaPengalihan } from "@/lib/galat-rute";

export const dynamic = "force-dynamic";

/** Samakan Jadwal Pelajaran dengan Penugasan Mengajar untuk satu (kelas, mata pelajaran).
 *
 * Dua arah, karena hanya sekolah yang tahu mana yang benar:
 *
 *   "ikut-jadwal"    — guru yang tercantum di JADWAL dianggap benar. Penugasan Mengajar untuk
 *                      kelas+mapel itu dipindahkan ke guru tersebut. Ini yang membuka kembali
 *                      akses nilai & jurnal bagi guru yang selama ini mengajar tanpa penugasan.
 *   "ikut-penugasan" — guru yang tercantum di PENUGASAN dianggap benar. Semua baris jadwal
 *                      kelas+mapel itu diganti gurunya.
 *
 * `TeachingAssignment` punya @@unique([classId, subjectId]) — satu mapel di satu kelas hanya boleh
 * punya satu pemegang — jadi "ikut-jadwal" adalah UPSERT (memindahkan pemegang), bukan menambah
 * baris kedua. Keduanya saling membatalkan, jadi salah pilih tinggal ditekan tombol sebelahnya.
 */
export async function POST(req: Request) {
  try {
    await verifyRole(["ADMIN", "TAS"]);
    const { aksi, classId, subject, guruJadwalId, guruPenugasanId } = await req.json();
    if (!classId || !subject) return NextResponse.json({ error: "Kelas & mata pelajaran wajib diisi." }, { status: 400 });

    // Subject disimpan di Schedule sebagai NAMA, sedangkan penugasan memakai id — cocokkan lewat
    // baris Subject milik tingkat kelas yang bersangkutan.
    const kelas = await prisma.class.findUnique({ where: { id: classId }, select: { grade: true, majorId: true, name: true } });
    if (!kelas) return NextResponse.json({ error: "Kelas tidak ditemukan." }, { status: 404 });

    if (aksi === "ikut-jadwal") {
      if (!guruJadwalId) return NextResponse.json({ error: "Guru pada jadwal tidak dikenali." }, { status: 400 });
      const mapel = await prisma.subject.findFirst({
        where: {
          name: subject, grade: kelas.grade,
          OR: [{ majorId: kelas.majorId }, { majorId: null }],
        },
        orderBy: { majorId: "desc" }, // yang khusus jurusan didahulukan daripada yang umum
        select: { id: true },
      });
      if (!mapel) {
        return NextResponse.json({ error: `Mata pelajaran "${subject}" tidak terdaftar untuk tingkat kelas ini.` }, { status: 404 });
      }
      await prisma.teachingAssignment.upsert({
        where: { classId_subjectId: { classId, subjectId: mapel.id } },
        update: { teacherId: guruJadwalId },
        create: { classId, subjectId: mapel.id, teacherId: guruJadwalId },
      });
      return NextResponse.json({ ok: true, pesan: `Penugasan ${subject} di ${kelas.name} dipindahkan mengikuti jadwal.` });
    }

    if (aksi === "ikut-penugasan") {
      if (!guruPenugasanId) {
        return NextResponse.json({ error: "Belum ada pemegang penugasan untuk mapel ini — pilih \"Jadwal yang benar\" atau isi penugasannya dulu." }, { status: 400 });
      }
      const hasil = await prisma.schedule.updateMany({
        where: { classId, subject }, data: { teacherId: guruPenugasanId },
      });
      return NextResponse.json({ ok: true, pesan: `${hasil.count} baris jadwal ${subject} di ${kelas.name} diganti gurunya mengikuti penugasan.` });
    }

    return NextResponse.json({ error: "Aksi tidak dikenali." }, { status: 400 });
  } catch (e) {
    lemparBilaPengalihan(e);
    return NextResponse.json({ error: "Gagal menyamakan jadwal & penugasan." }, { status: 500 });
  }
}
