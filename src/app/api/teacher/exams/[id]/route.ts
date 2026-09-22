import { prisma } from "@/lib/prisma";
import { kirimSinyal } from "@/lib/sinyal-ujian";
import { verifyRole } from "@/lib/dal";
import { bacaKelasIds, jumlahSiswaAktif, kelasPeserta, periksaKelasPeserta, ujianDalamCakupan } from "@/lib/ujian-server";
import { ambilPengaturan, siapkanSoalUjian, terapkanJadwalKelas } from "@/lib/ujian-pengaturan";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id))) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });

    const exam = await prisma.exam.findUnique({
      where: { id },
      include: {
        class: { select: { id: true, name: true } },
        teacher: { select: { user: { select: { name: true } } } },
        // Token kegiatan ikut dikirim: halaman detail menampilkan token yang SAMA dengan
        // Ruang Kendali (satu token untuk semua mapel di kegiatan itu).
        kegiatan: { select: { id: true, nama: true, singkatan: true, token: true } },
        questions: { orderBy: { order: "asc" }, include: { stimulus: { select: { id: true, judul: true, konten: true } } } },
        _count: { select: { attempts: true } },
      },
    });
    if (!exam) return Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    const ids = kelasPeserta(exam);
    const [kelasRows, jumlah, bolehUbah] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      jumlahSiswaAktif(ids),
      ujianDalamCakupan(session, id, { ubah: true }).then(Boolean),
    ]);
    const kelas = kelasRows.map(k => ({ ...k, jumlahSiswa: jumlah.get(k.id) ?? 0 }));
    return Response.json({
      ...exam, kelasIds: ids, kelas, bolehUbah,
      attemptCount: exam._count.attempts,
      jumlahSiswa: exam.pesertaIds.length ? exam.pesertaIds.length : kelas.reduce((n, k) => n + k.jumlahSiswa, 0),
    });
  } catch {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    const exam = await ujianDalamCakupan(session, id, { ubah: true });
    if (!exam) {
      return (await ujianDalamCakupan(session, id))
        ? Response.json({ error: "Anda guru pengampu ujian ini — soal & pengaturan hanya bisa diubah guru pembuatnya atau Admin/Kurikulum." }, { status: 403 })
        : Response.json({ error: "Ujian tidak ditemukan" }, { status: 404 });
    }
    const body = await req.json();

    // Perubahan status terbit saja
    if (typeof body.isPublished === "boolean" && Object.keys(body).length === 1) {
      const hasil = await prisma.exam.update({ where: { id }, data: { isPublished: body.isPublished } });
      kirimSinyal(id);
      return Response.json(hasil);
    }

    const p = ambilPengaturan(body);
    if (p.kegiatanId && !(await prisma.kegiatanUjian.findUnique({ where: { id: p.kegiatanId as string }, select: { id: true } }))) {
      return Response.json({ error: "Kegiatan ujian tidak ditemukan." }, { status: 400 });
    }
    if (p.startTime && p.endTime && (p.startTime as Date) >= (p.endTime as Date)) {
      return Response.json({ error: "Waktu mulai harus sebelum waktu selesai." }, { status: 400 });
    }

    // Soal DIKUNCI begitu ada siswa yang mengerjakan: mengganti soal saat itu membuat jawaban yang
    // sudah tersimpan (dikunci per id soal) salah sasaran. Pengaturan lain tetap boleh diubah.
    // Kelas peserta: kelas BARU diperiksa (guru hanya boleh menambah kelas yang ia ampu); kelas yang
    // siswanya sudah mengerjakan tidak boleh dilepas supaya hasilnya tidak yatim.
    let kelasData: { kelasIds?: string[]; classId?: string } = {};
    if (Array.isArray(body.kelasIds)) {
      const baru = bacaKelasIds(body);
      if (!baru.length) return Response.json({ error: "Pilih minimal satu kelas peserta." }, { status: 400 });
      const lama = kelasPeserta(exam);
      const ditambah = baru.filter(k => !lama.includes(k));
      if (ditambah.length) {
        const cek = await periksaKelasPeserta(session, exam.subject, ditambah);
        if ("error" in cek) return Response.json({ error: cek.error }, { status: 400 });
      }
      const dilepas = lama.filter(k => !baru.includes(k));
      if (dilepas.length && (await prisma.examAttempt.count({ where: { examId: id, student: { classId: { in: dilepas } } } })) > 0) {
        return Response.json({ error: "Kelas yang siswanya sudah mengerjakan tidak bisa dikeluarkan dari ujian ini." }, { status: 409 });
      }
      kelasData = { kelasIds: baru, classId: baru[0] };
    }
    const galatJadwal = terapkanJadwalKelas(p, body, kelasData.kelasIds ?? kelasPeserta(exam), {
      startTime: (p.startTime as Date | undefined) ?? exam.startTime, endTime: (p.endTime as Date | undefined) ?? exam.endTime,
    });
    if (galatJadwal) return Response.json({ error: galatJadwal }, { status: 400 });

    const attemptCount = await prisma.examAttempt.count({ where: { examId: id } });
    if (Array.isArray(body.questions)) {
      if (attemptCount > 0) return Response.json({ error: "Soal tidak bisa diubah - sudah ada siswa yang mengerjakan ujian ini." }, { status: 409 });
      const { data: qs, error } = siapkanSoalUjian(body.questions);
      if (error) return Response.json({ error }, { status: 400 });
      await prisma.$transaction(async tx => {
        await tx.examQuestion.deleteMany({ where: { examId: id } });
        await tx.exam.update({
          where: { id },
          data: {
            ...p,
            ...kelasData,
            questions: {
              create: qs.map((q, i) => ({
                tipe: q.tipe, pertanyaan: q.pertanyaan, opsi: q.opsi as object, kunci: (q.kunci ?? undefined) as object | undefined,
                skor: q.skor ?? 1, kd: q.kd ?? null, pembahasan: q.pembahasan ?? null, stimulusId: q.stimulusId ?? null,
                materi: q.materi ?? null, indikator: q.indikator ?? null, levelKognitif: q.levelKognitif ?? null,
                order: i, posisiKunci: q.posisiKunci,
              })),
            },
          },
        });
      });
    } else {
      await prisma.exam.update({ where: { id }, data: { ...p, ...kelasData } });
    }
    const tersimpan = await prisma.exam.findUnique({ where: { id }, include: { questions: { orderBy: { order: "asc" } } } });
    kirimSinyal(id); // jadwal/durasi mungkin berubah — tenggat peserta diperbarui lewat denyut
    return Response.json(tersimpan);
  } catch {
    return Response.json({ error: "Gagal memperbarui ujian." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const { id } = await params;
    if (!(await ujianDalamCakupan(session, id, { ubah: true }))) {
      return Response.json({ error: "Ujian tidak ditemukan, atau hanya guru pembuatnya yang bisa menghapus." }, { status: 404 });
    }
    await prisma.exam.delete({ where: { id } });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Gagal menghapus ujian." }, { status: 500 });
  }
}
