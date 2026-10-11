import "server-only";
import { prisma } from "@/lib/prisma";
import type { IsiNotifikasi } from "@/lib/push-server";

/** PENGINGAT EKSTRAKURIKULER (10 Okt 2026) — dijalankan `jalankanPengingat` pada jam `notifikasi.jamEkstra` (bawaan 17.30).
 *  Dua hal dalam SATU kabar per orang per hari:
 *   1. Ekskul yang hari ini HARI LATIHANNYA (`hariRutin`, atau ada agenda berjenis LATIHAN hari ini) tetapi belum ada
 *      absensinya. Pembina dari luar sekolah tidak punya akun, jadi yang dikabari KOORDINATOR — ia yang menghubungi
 *      pembinanya. Pembina ber-akun (jabatan "Pembina <ekskul>") dikabari untuk ekskulnya sendiri.
 *   2. Jumlah siswa yang mendaftar dan masih menunggu keputusan (pendaftar tidak dikabarkan satu per satu).
 *  Diam di hari libur (gerbang `cekLibur` di pemanggil) dan ikut Pratinjau lewat parameter `kirim`. */
// Sama dengan `KOORDINATOR` di ekstra-server.ts — tidak diimpor supaya modul penjadwal ini tidak menarik penjaga halaman.
const KOORDINATOR = "Koordinator Ekstrakurikuler";

export async function pengingatEkstra(w: { tanggal: string }, opsi: { kirim: (n: IsiNotifikasi) => Promise<unknown> }) {
  const hari = new Date(`${w.tanggal}T00:00:00Z`), besok = new Date(hari.getTime() + 86_400_000);
  const dow = hari.getUTCDay();
  // Agenda disimpan sebagai waktu sungguhan → hari WIB = [tengah malam WIB, +24 jam).
  const awalWib = new Date(hari.getTime() - 7 * 3600_000), akhirWib = new Date(besok.getTime() - 7 * 3600_000);
  const [ekskul, agenda, sudah, menunggu] = await Promise.all([
    prisma.extracurricular.findMany({ select: { id: true, name: true, hariRutin: true, pembinaNama: true, _count: { select: { members: true } } } }),
    prisma.agendaEkstra.findMany({ where: { jenis: "LATIHAN", mulai: { gte: awalWib, lt: akhirWib } }, select: { extracurricularId: true } }),
    prisma.extracurricularJournal.findMany({ where: { date: { gte: hari, lt: besok }, entries: { some: {} } }, select: { extracurricularId: true } }),
    prisma.pendaftaranEkstra.groupBy({ by: ["extracurricularId"], where: { status: "MENUNGGU", student: { studentStatus: "AKTIF" } }, _count: { _all: true } }),
  ]);
  const terjadwal = new Set(agenda.map(a => a.extracurricularId)), terisi = new Set(sudah.map(s => s.extracurricularId));
  const belum = ekskul.filter(e => e._count.members > 0 && (e.hariRutin.includes(dow) || terjadwal.has(e.id)) && !terisi.has(e.id));
  const antre = new Map(menunggu.map(m => [m.extracurricularId, m._count._all]));
  if (!belum.length && !antre.size) return;

  const jab = await prisma.jabatan.findMany({
    where: { name: { in: [KOORDINATOR, ...ekskul.map(e => `Pembina ${e.name}`)] } },
    select: { name: true, teachers: { select: { teacher: { select: { userId: true } } } }, staff: { select: { userId: true } } },
  }).catch(() => []);
  const pemegang = (nama: string) => { const j = jab.find(x => x.name === nama); return j ? [...j.teachers.map(t => t.teacher.userId), ...j.staff.map(s => s.userId)] : []; };
  const koordinator = new Set(pemegang(KOORDINATOR));

  const susun = (daftarBelum: typeof belum, jumlahAntre: number, untukKoordinator: boolean) => {
    const bagian: string[] = [];
    if (daftarBelum.length) bagian.push(`Latihan hari ini belum diabsen: ${daftarBelum.map(e => e.name + (untukKoordinator && e.pembinaNama ? ` (pembina ${e.pembinaNama})` : "")).join(", ")}.`);
    if (jumlahAntre) bagian.push(`${jumlahAntre} siswa mendaftar dan menunggu keputusan.`);
    return bagian.join(" ");
  };
  // Koordinator: satu kabar berisi semuanya.
  const totalAntre = [...antre.values()].reduce((a, b) => a + b, 0);
  for (const userId of koordinator) {
    await opsi.kirim({
      userIds: [userId], jenis: "EKSTRA", kunci: `ekstra-harian:${w.tanggal}:${userId}`, gantiHariIni: true,
      judul: belum.length ? "Absensi ekstrakurikuler belum diisi" : "Pendaftar ekstrakurikuler menunggu",
      isi: susun(belum, totalAntre, true), url: belum.length ? "/pusat-ekstra/absensi" : "/pusat-ekstra/pendaftaran",
    });
  }
  // Pembina ber-akun: hanya ekskulnya, dan tidak dobel bila ia juga koordinator.
  const perOrang = new Map<string, { belum: typeof belum; antre: number }>();
  for (const e of ekskul) {
    const b = belum.some(x => x.id === e.id), a = antre.get(e.id) ?? 0;
    if (!b && !a) continue;
    for (const userId of pemegang(`Pembina ${e.name}`)) {
      if (koordinator.has(userId)) continue;
      const x = perOrang.get(userId) ?? { belum: [], antre: 0 };
      if (b) x.belum.push(e); x.antre += a; perOrang.set(userId, x);
    }
  }
  for (const [userId, x] of perOrang) {
    await opsi.kirim({
      userIds: [userId], jenis: "EKSTRA", kunci: `ekstra-harian:${w.tanggal}:${userId}`, gantiHariIni: true,
      judul: x.belum.length ? "Absensi latihan belum diisi" : "Pendaftar ekstrakurikuler menunggu",
      isi: susun(x.belum, x.antre, false), url: x.belum.length ? "/pusat-ekstra/absensi" : "/pusat-ekstra/pendaftaran",
    });
  }
}
