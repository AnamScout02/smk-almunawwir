import { lemparBilaPengalihan } from "@/lib/galat-rute";
import { prisma } from "@/lib/prisma";
import { verifyRole } from "@/lib/dal";
import { bacaKelasIds, buatTokenUnik, filterDaftarUjian, periksaKelasPeserta, petaNamaKelas, ujianUntukKelas } from "@/lib/ujian-server";
import { ambilPengaturan, siapkanSoalUjian, terapkanJadwalKelas } from "@/lib/ujian-pengaturan";
import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/** Daftar ujian. Guru melihat ujian buatannya + ujian mapel yang ia ampu di salah satu kelas
 * pesertanya. `?classId=` = ujian yang DIIKUTI kelas itu (termasuk ujian banyak-kelas). */
export async function GET(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const sp = new URL(req.url).searchParams;
    const classId = sp.get("classId") || undefined;
    const subject = sp.get("subject") || undefined;
    const filterGuru = await filterDaftarUjian(session);

    const where: Prisma.ExamWhereInput = {
      AND: [filterGuru ?? {}, classId ? ujianUntukKelas(classId) : {}],
      ...(subject ? { subject } : {}),
    };
    const exams = await prisma.exam.findMany({
      where,
      include: {
        class: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
        kegiatan: { select: { id: true, nama: true, singkatan: true, token: true } },
        _count: { select: { questions: true, attempts: true } },
        attempts: { where: { submittedAt: { not: null } }, select: { score: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const kelas = await petaNamaKelas(exams);
    return Response.json(exams.map(e => ({ ...e, kelasNama: kelas.daftar(e) })));
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
}

/** Buat ujian. `kelasIds` = semua kelas peserta (satu ujian boleh untuk banyak kelas); `classId`
 * tunggal dari klien lama tetap diterima. */
export async function POST(req: NextRequest) {
  try {
    const session = await verifyRole(["TEACHER", "ADMIN", "TAS"]);
    const body = await req.json();
    const { subject, questions } = body;
    const kelasIds = bacaKelasIds(body);
    const p = ambilPengaturan(body);
    if (!kelasIds.length || !String(subject ?? "").trim() || !p.title || !p.duration || !p.startTime || !p.endTime) {
      return Response.json({ error: "Kelas, mata pelajaran, judul, durasi, dan jadwal wajib diisi." }, { status: 400 });
    }
    if ((p.startTime as Date) >= (p.endTime as Date)) return Response.json({ error: "Waktu mulai harus sebelum waktu selesai." }, { status: 400 });
    const galatJadwal = terapkanJadwalKelas(p, body, kelasIds, { startTime: p.startTime as Date, endTime: p.endTime as Date });
    if (galatJadwal) return Response.json({ error: galatJadwal }, { status: 400 });
    if (p.kegiatanId && !(await prisma.kegiatanUjian.findUnique({ where: { id: p.kegiatanId as string }, select: { id: true } }))) {
      return Response.json({ error: "Kegiatan ujian tidak ditemukan." }, { status: 400 });
    }
    const { data: qs, error } = siapkanSoalUjian(Array.isArray(questions) ? questions : []);
    if (error) return Response.json({ error }, { status: 400 });

    // Guru hanya boleh memilih kelas yang ia ampu mapelnya (celah lama: guru bisa membuat ujian
    // untuk kelas mana pun). Admin/TAS/Kurikulum bebas; pemiliknya guru pengampu kelas pertama.
    const cek = await periksaKelasPeserta(session, String(subject).trim(), kelasIds);
    if ("error" in cek) return Response.json({ error: cek.error }, { status: 403 });

    const exam = await prisma.exam.create({
      data: {
        teacherId: cek.pemilik, classId: kelasIds[0], kelasIds,
        subject: String(subject).trim(), token: await buatTokenUnik(),
        ...(p as { title: string; duration: number; startTime: Date; endTime: Date }),
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
    return Response.json(exam);
  } catch (galat) {
    lemparBilaPengalihan(galat);
    return Response.json({ error: "Gagal menyimpan ujian." }, { status: 500 });
  }
}
