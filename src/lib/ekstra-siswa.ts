import "server-only";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import { semesterRapor, rentangSemester } from "@/lib/rapor-verifikasi";
import type { IsiNotifikasi } from "@/lib/push-server";

/** EKSKUL DARI SISI SISWA & ORANG TUA (10 Oktober 2026).
 *   - Siswa melihat ekskul yang ia ikuti: kehadiran semester berjalan, kegiatan & foto, jadwal mendatang, nilai.
 *     Orang tua melihat hal yang sama untuk anaknya (hanya baca). Foto hanya dari ekskul yang diikuti anak itu.
 *   - PENDAFTARAN: siswa memilih ekskul → `PendaftaranEkstra` MENUNGGU → pembina/koordinator memutuskan → DITERIMA
 *     membuat `ExtracurricularMember`. Dibuka/ditutup koordinator (`ekstra.pendaftaranDibuka`), dibatasi jumlah
 *     pilihan (`ekstra.maksPilihan`, dihitung dari keanggotaan + pendaftaran yang masih menunggu) dan kuota per ekskul.
 *   - Pendaftar baru TIDAK dikabarkan satu per satu ke koordinator (awal semester bisa ratusan sekaligus): jumlahnya
 *     tampil di Pusat Ekstra dan ikut pengingat harian. Keputusan dikabarkan ke siswanya. */
export const KUNCI_DAFTAR = { dibuka: "ekstra.pendaftaranDibuka", maks: "ekstra.maksPilihan" } as const;

export async function setelanDaftarEkstra(): Promise<{ dibuka: boolean; maks: number }> {
  const s = await getSettings([KUNCI_DAFTAR.dibuka, KUNCI_DAFTAR.maks]).catch(() => ({} as Record<string, string>));
  const maks = Number(s[KUNCI_DAFTAR.maks]);
  // Bawaan TERBUKA dengan paling banyak 3 pilihan: ekskul yang anggotanya masih kosong menunggu pendaftar.
  return { dibuka: s[KUNCI_DAFTAR.dibuka] !== "0", maks: Number.isFinite(maks) && maks >= 1 && maks <= 10 ? Math.round(maks) : 3 };
}

const semesterKini = () => { const s = semesterRapor(); const b = new Date(Date.now() + 7 * 3600_000).getUTCMonth() + 1; return b >= 7 ? s[2] : s[3]; };

/** Pembina yang tampil ke siswa: pemegang jabatan "Pembina <ekskul>" + pembina luar (nama saja, tanpa kontak). */
async function petaPembina(ekskul: { name: string; pembinaNama: string | null }[]) {
  const jab = await prisma.jabatan.findMany({
    where: { name: { in: ekskul.map(e => `Pembina ${e.name}`) } },
    select: { name: true, teachers: { select: { teacher: { select: { user: { select: { name: true } } } } } }, staff: { select: { user: { select: { name: true } } } } },
  }).catch(() => []);
  return new Map(ekskul.map(e => {
    const j = jab.find(x => x.name === `Pembina ${e.name}`);
    const nama = [...(j ? [...j.teachers.map(t => t.teacher.user.name), ...j.staff.map(s => s.user.name)] : []), ...(e.pembinaNama ? [e.pembinaNama] : [])];
    return [e.name, nama];
  }));
}

export async function ekstraSiswa(studentId: string, opsi: { denganTersedia: boolean }) {
  const semester = semesterKini(), r = rentangSemester(semester);
  const [siswa, anggota, daftar, setelan] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, select: { studentStatus: true, user: { select: { name: true } }, class: { select: { name: true } } } }),
    prisma.extracurricularMember.findMany({
      where: { studentId }, orderBy: { extracurricular: { name: "asc" } },
      select: { role: true, joinedAt: true, extracurricular: { select: { id: true, name: true, jenis: true, jadwalRutin: true, pembinaNama: true } } },
    }),
    prisma.pendaftaranEkstra.findMany({ where: { studentId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, status: true, alasan: true, catatan: true, createdAt: true, diputusAt: true, extracurricular: { select: { id: true, name: true } } } }),
    setelanDaftarEkstra(),
  ]);
  const ids = anggota.map(a => a.extracurricular.id);
  const [jurnal, agenda, nilai] = await Promise.all([
    ids.length ? prisma.extracurricularJournal.findMany({
      where: { extracurricularId: { in: ids }, ...(r ? { date: { gte: r.mulai, lt: r.akhir } } : {}) }, orderBy: { date: "desc" },
      select: { extracurricularId: true, date: true, materi: true, foto: true, entries: { where: { studentId }, select: { status: true } } },
    }) : [],
    ids.length ? prisma.agendaEkstra.findMany({ where: { extracurricularId: { in: ids }, mulai: { gte: new Date(Date.now() - 6 * 3600_000) } }, orderBy: { mulai: "asc" }, take: 30, select: { extracurricularId: true, judul: true, jenis: true, mulai: true, tempat: true } }) : [],
    ids.length ? prisma.nilaiEkstra.findMany({ where: { studentId, extracurricularId: { in: ids } }, orderBy: { semester: "desc" }, select: { extracurricularId: true, semester: true, predikat: true, keterangan: true } }) : [],
  ]);
  const semuaEkskul = opsi.denganTersedia
    ? await prisma.extracurricular.findMany({ orderBy: [{ jenis: "asc" }, { name: "asc" }], select: { id: true, name: true, jenis: true, jadwalRutin: true, pembinaNama: true, bukaDaftar: true, kuota: true, deskripsi: true, _count: { select: { members: true } } } })
    : [];
  const pembina = await petaPembina([...anggota.map(a => a.extracurricular), ...semuaEkskul]);

  const ikut = anggota.map(a => {
    const e = a.extracurricular, j = jurnal.filter(x => x.extracurricularId === e.id);
    const hitung = { HADIR: 0, IZIN: 0, SAKIT: 0, ALPHA: 0 } as Record<string, number>;
    for (const x of j) { const st = x.entries[0]?.status; if (st && st in hitung) hitung[st]++; }
    return {
      id: e.id, nama: e.name, jenis: e.jenis, peran: a.role ?? "", jadwalRutin: e.jadwalRutin, pembina: pembina.get(e.name) ?? [],
      sejak: a.joinedAt.toISOString(), kehadiran: hitung, pertemuan: j.length,
      // Paling banyak 12 pertemuan terbaru; foto hanya alamat berkasnya (folder ekstra bukan data pribadi, CLAUDE.md #163).
      kegiatan: j.slice(0, 12).map(x => ({ tanggal: x.date.toISOString().slice(0, 10), materi: x.materi ?? "", status: x.entries[0]?.status ?? "", foto: x.foto })),
      agenda: agenda.filter(x => x.extracurricularId === e.id).slice(0, 5).map(x => ({ judul: x.judul, jenis: x.jenis, mulai: x.mulai.toISOString(), tempat: x.tempat })),
      nilai: nilai.filter(x => x.extracurricularId === e.id).map(x => ({ semester: x.semester, predikat: x.predikat, keterangan: x.keterangan })),
    };
  });
  const sudah = new Set(ids), menunggu = new Set(daftar.filter(d => d.status === "MENUNGGU").map(d => d.extracurricular.id));
  return {
    siswa: { nama: siswa?.user.name ?? "", kelas: siswa?.class?.name ?? "" }, semester, ikut,
    pendaftaran: daftar.map(d => ({ id: d.id, ekskulId: d.extracurricular.id, ekskul: d.extracurricular.name, status: d.status, alasan: d.alasan, catatan: d.catatan, dibuat: d.createdAt.toISOString(), diputus: d.diputusAt?.toISOString() ?? null })),
    setelan: { ...setelan, terpakai: sudah.size + menunggu.size },
    tersedia: semuaEkskul.filter(e => !sudah.has(e.id)).map(e => ({
      id: e.id, nama: e.name, jenis: e.jenis, jadwalRutin: e.jadwalRutin, deskripsi: e.deskripsi, pembina: pembina.get(e.name) ?? [],
      anggota: e._count.members, kuota: e.kuota, buka: e.bukaDaftar, penuh: e.kuota != null && e._count.members >= e.kuota, menunggu: menunggu.has(e.id),
    })),
  };
}

export async function daftarEkstra(studentId: string, extracurricularId: string, alasan: string | null): Promise<{ ok: true } | { galat: string; kode: number }> {
  const [setelan, siswa, e] = await Promise.all([
    setelanDaftarEkstra(),
    prisma.student.findUnique({ where: { id: studentId }, select: { studentStatus: true } }),
    prisma.extracurricular.findUnique({ where: { id: extracurricularId }, select: { id: true, name: true, bukaDaftar: true, kuota: true, _count: { select: { members: true } } } }),
  ]);
  if (siswa?.studentStatus !== "AKTIF") return { galat: "Hanya siswa aktif yang bisa mendaftar.", kode: 403 };
  if (!setelan.dibuka) return { galat: "Pendaftaran ekstrakurikuler sedang ditutup.", kode: 409 };
  if (!e) return { galat: "Ekstrakurikuler tidak ditemukan.", kode: 404 };
  if (!e.bukaDaftar) return { galat: `${e.name} sedang tidak menerima pendaftar baru.`, kode: 409 };
  if (e.kuota != null && e._count.members >= e.kuota) return { galat: `Kuota ${e.name} sudah penuh.`, kode: 409 };
  const [anggota, menunggu] = await Promise.all([
    prisma.extracurricularMember.findMany({ where: { studentId }, select: { extracurricularId: true } }),
    prisma.pendaftaranEkstra.findMany({ where: { studentId, status: "MENUNGGU" }, select: { extracurricularId: true } }),
  ]);
  if (anggota.some(a => a.extracurricularId === e.id)) return { galat: `Kamu sudah menjadi anggota ${e.name}.`, kode: 409 };
  if (menunggu.some(a => a.extracurricularId === e.id)) return { galat: `Pendaftaranmu ke ${e.name} masih menunggu keputusan pembina.`, kode: 409 };
  if (new Set([...anggota, ...menunggu].map(a => a.extracurricularId)).size >= setelan.maks) return { galat: `Paling banyak ${setelan.maks} kegiatan per siswa (termasuk yang masih menunggu keputusan).`, kode: 409 };
  await prisma.pendaftaranEkstra.create({ data: { extracurricularId: e.id, studentId, alasan } });
  return { ok: true };
}

/** Putuskan pendaftaran. `ekskulIds` = ekskul yang boleh diputuskan pemanggil (null = semua, koordinator/Admin).
 *  DITERIMA membuat keanggotaan; kuota diperiksa lagi di sini supaya menerima massal tidak melampauinya. `kirim`
 *  disuntikkan supaya logikanya bisa diuji tanpa mengirim apa pun. */
export async function putuskanPendaftaran(o: { ids: string[]; terima: boolean; catatan: string | null; oleh: string; ekskulIds: string[] | null; kirim: (n: IsiNotifikasi) => Promise<unknown> }) {
  const baris = await prisma.pendaftaranEkstra.findMany({
    where: { id: { in: o.ids }, status: "MENUNGGU", ...(o.ekskulIds ? { extracurricularId: { in: o.ekskulIds } } : {}) }, orderBy: { createdAt: "asc" },
    select: { id: true, studentId: true, extracurricularId: true, student: { select: { userId: true, studentStatus: true } }, extracurricular: { select: { name: true, kuota: true, _count: { select: { members: true } } } } },
  });
  const terisi = new Map<string, number>();
  let diterima = 0, ditolak = 0; const penuh: string[] = [];
  for (const b of baris) {
    const e = b.extracurricular, isi = terisi.get(b.extracurricularId) ?? e._count.members;
    if (o.terima && e.kuota != null && isi >= e.kuota) { if (!penuh.includes(e.name)) penuh.push(e.name); continue; }
    const terima = o.terima && b.student.studentStatus === "AKTIF";
    await prisma.$transaction(async tx => {
      if (terima) await tx.extracurricularMember.upsert({ where: { extracurricularId_studentId: { extracurricularId: b.extracurricularId, studentId: b.studentId } }, create: { extracurricularId: b.extracurricularId, studentId: b.studentId }, update: {} });
      await tx.pendaftaranEkstra.update({ where: { id: b.id }, data: { status: terima ? "DITERIMA" : "DITOLAK", catatan: o.catatan, diputusOleh: o.oleh, diputusAt: new Date() } });
    });
    if (terima) { diterima++; terisi.set(b.extracurricularId, isi + 1); } else ditolak++;
    await o.kirim({
      userIds: [b.student.userId], jenis: "EKSTRA", kunci: `ekstra-daftar:${b.id}`, url: "/dashboard/student/ekstrakurikuler",
      judul: terima ? `Diterima di ${e.name}` : `Pendaftaran ${e.name} belum diterima`,
      isi: terima ? `Kamu sekarang anggota ${e.name}. Lihat jadwal latihannya di menu Ekstrakurikuler.` : (o.catatan ? `Catatan pembina: ${o.catatan}` : "Kamu bisa memilih kegiatan lain di menu Ekstrakurikuler."),
    }).catch(() => null);
  }
  return { diterima, ditolak, penuh };
}

/** Pendaftar yang menunggu, untuk ekskul tertentu (null = semua). Hanya nama & kelas — tanpa NIS/kontak. */
export async function pendaftarMenunggu(ekskulIds: string[] | null) {
  const b = await prisma.pendaftaranEkstra.findMany({
    where: { status: "MENUNGGU", ...(ekskulIds ? { extracurricularId: { in: ekskulIds } } : {}), student: { studentStatus: "AKTIF" } }, orderBy: { createdAt: "asc" }, take: 600,
    select: { id: true, extracurricularId: true, alasan: true, createdAt: true, student: { select: { user: { select: { name: true } }, class: { select: { name: true } } } } },
  });
  return b.map(x => ({ id: x.id, ekskulId: x.extracurricularId, nama: x.student.user.name, kelas: x.student.class?.name ?? "", alasan: x.alasan, dibuat: x.createdAt.toISOString() }));
}
