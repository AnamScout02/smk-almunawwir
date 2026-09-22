import "server-only";
import { prisma } from "@/lib/prisma";
import { kelasPeserta } from "@/lib/ujian-server";
import { jendelaKelas, bacaJadwalKelas } from "@/lib/jadwal-ujian-kelas";

/** PENGAWAS KEGIATAN PER KELAS (21 September 2026). Permintaan user: pada ujian per kelas seperti STS "mata
 * pelajaran akan diawasi oleh guru yang bersangkutan" — AIJ XI TKJ 1 jam 07.15–08.15 diawasi guru AIJ kelas itu,
 * lalu jam berikutnya XI TKJ 2 — "tapi tetap dijadwalkan".
 *
 * Satu baris = satu ujian × satu kelas peserta, pada jam kelas itu (`jendelaKelas`). Pengawas bawaan = guru pengampu
 * mapel ujian di kelas itu menurut Penugasan Mengajar (cadangan: pembuat ujian) dan TIDAK disimpan — berubahnya
 * Penugasan Mengajar langsung ikut. Wakakur bisa menggantinya (`PengawasKelasUjian`). */

export interface Orang { id: string; nama: string }
export interface BarisPengawasKelas {
  examId: string; judul: string; mapel: string; terbit: boolean;
  classId: string; kelas: string;
  mulai: string; selesai: string; jamKhusus: boolean;
  otomatis: Orang | null;
  pengganti: Orang | null;
  pengawas: Orang | null;
  /** Guru pengawas yang sama terjadwal di baris lain pada jam yang bertumpuk. */
  bentrok: boolean;
}

export async function susunPengawasKelas(kegiatanId: string): Promise<BarisPengawasKelas[]> {
  const exams = await prisma.exam.findMany({
    where: { kegiatanId, pesertaIds: { isEmpty: true } }, // susulan/remedial diawasi terpisah
    select: {
      id: true, title: true, subject: true, isPublished: true, classId: true, kelasIds: true,
      startTime: true, endTime: true, jadwalKelas: true,
      teacher: { select: { id: true, user: { select: { name: true } } } },
    },
    orderBy: { startTime: "asc" },
  });
  if (!exams.length) return [];
  const semuaKelas = [...new Set(exams.flatMap(e => kelasPeserta(e)))];
  const [kelas, ampu, ganti] = await Promise.all([
    prisma.class.findMany({ where: { id: { in: semuaKelas } }, select: { id: true, name: true } }),
    prisma.teachingAssignment.findMany({
      where: { classId: { in: semuaKelas }, subject: { name: { in: [...new Set(exams.map(e => e.subject))] } } },
      select: { classId: true, subject: { select: { name: true } }, teacher: { select: { id: true, user: { select: { name: true } } } } },
    }),
    prisma.pengawasKelasUjian.findMany({
      where: { examId: { in: exams.map(e => e.id) } },
      select: { examId: true, classId: true, teacher: { select: { id: true, user: { select: { name: true } } } } },
    }),
  ]);
  const namaKelas = new Map(kelas.map(k => [k.id, k.name]));
  const pengampu = new Map(ampu.map(a => [`${a.classId}|${a.subject.name}`, { id: a.teacher.id, nama: a.teacher.user.name }]));
  const pengganti = new Map(ganti.map(g => [`${g.examId}|${g.classId}`, { id: g.teacher.id, nama: g.teacher.user.name }]));

  const baris: BarisPengawasKelas[] = [];
  for (const e of exams) {
    const jadwal = bacaJadwalKelas(e.jadwalKelas);
    for (const classId of kelasPeserta(e)) {
      if (!namaKelas.has(classId)) continue;
      const j = jendelaKelas(e, classId);
      const otomatis = pengampu.get(`${classId}|${e.subject}`) ?? { id: e.teacher.id, nama: e.teacher.user.name };
      const ganti1 = pengganti.get(`${e.id}|${classId}`) ?? null;
      baris.push({
        examId: e.id, judul: e.title, mapel: e.subject, terbit: e.isPublished,
        classId, kelas: namaKelas.get(classId)!,
        mulai: j.startTime.toISOString(), selesai: j.endTime.toISOString(), jamKhusus: !!jadwal[classId],
        otomatis, pengganti: ganti1, pengawas: ganti1 ?? otomatis, bentrok: false,
      });
    }
  }
  // Bentrok: guru yang sama di dua baris yang jamnya bertumpuk (mis. dua kelas AIJ dijadwalkan bersamaan).
  const perGuru = new Map<string, BarisPengawasKelas[]>();
  for (const b of baris) if (b.pengawas) perGuru.set(b.pengawas.id, [...(perGuru.get(b.pengawas.id) ?? []), b]);
  for (const daftar of perGuru.values()) {
    for (let i = 0; i < daftar.length; i++) for (let k = i + 1; k < daftar.length; k++) {
      const a = daftar[i], b = daftar[k];
      if (a.mulai < b.selesai && b.mulai < a.selesai) { a.bentrok = true; b.bentrok = true; }
    }
  }
  return baris.sort((a, b) => a.mulai.localeCompare(b.mulai) || a.kelas.localeCompare(b.kelas, "id", { numeric: true }));
}

/** Tugas mengawas satu guru dari SEMUA kegiatan per kelas yang aktif — untuk halaman Jadwal Pengawas guru. */
export async function tugasPengawasKelasGuru(teacherId: string): Promise<(BarisPengawasKelas & { kegiatan: string })[]> {
  const kegiatan = await prisma.kegiatanUjian.findMany({ where: { aktif: true, mekanisme: "KELAS" }, select: { id: true, singkatan: true, nama: true } });
  const hasil: (BarisPengawasKelas & { kegiatan: string })[] = [];
  for (const k of kegiatan) {
    for (const b of await susunPengawasKelas(k.id)) if (b.pengawas?.id === teacherId) hasil.push({ ...b, kegiatan: `${k.singkatan} — ${k.nama}` });
  }
  return hasil.sort((a, b) => a.mulai.localeCompare(b.mulai));
}
