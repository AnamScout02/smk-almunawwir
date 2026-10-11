import "server-only";
import { prisma } from "@/lib/prisma";
import { daftarLibur } from "@/lib/hari-libur";
import { pekanKini, wibIso } from "@/lib/jurnal-cepat";
import { susunKeterlaksanaan } from "@/lib/keterlaksanaan";
import { susunKelengkapan } from "@/lib/kelengkapan-perangkat";
import { SUMBER_TURUNAN } from "@/lib/presensi-sumber";

/** RAPOR KINERJA GURU PER SEMESTER (10 Oktober 2026, pilihan user) — satu lembar per guru, SELURUHNYA dibaca dari data
 *  yang sudah ada; tidak ada isian baru dan tidak ada angka gabungan/"nilai akhir" buatan: bobot antar-aspek adalah
 *  keputusan pimpinan, bukan keputusan kode. Aspek yang datanya kosong ditulis "belum ada data", tidak dihitung nol.
 *
 *  MASUKAN REKAN: hanya JUMLAH per jenis. Isi & pengirim tidak dibaca di sini (kontrak anonim, CLAUDE.md #92). */
export async function susunRaporKinerja(teacherId: string) {
  const guru = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: {
      id: true, nip: true, subject: true, position: true, userId: true,
      user: { select: { name: true } },
      jabatan: { select: { jabatan: { select: { name: true } } } },
      homeroomOf: { select: { name: true } },
    },
  });
  if (!guru) return null;
  const hariIni = wibIso(), pk = await pekanKini(hariIni);
  const awal = new Date(`${pk.mulai}T00:00:00Z`), akhir = new Date(new Date(`${hariIni}T00:00:00Z`).getTime() + 86400000);
  // Presensi Pegawai baru dipakai sekolah di tengah semester: hari sekolah dihitung sejak catatan presensi PERTAMA
  // (siapa pun) pada semester ini, supaya pekan-pekan sebelum presensi dipakai tidak terbaca "belum tercatat".
  const presensiPertama = await prisma.staffAttendance.findFirst({ where: { tanggal: { gte: awal } }, orderBy: { tanggal: "asc" }, select: { tanggal: true } }).catch(() => null);
  const mulaiPresensi = presensiPertama ? presensiPertama.tanggal.toISOString().slice(0, 10) : hariIni;
  const awalPresensi = new Date(`${mulaiPresensi}T00:00:00Z`);

  const [libur, harian, piket, terlaksana, perangkat, supervisi, pkb, masukan] = await Promise.all([
    daftarLibur(mulaiPresensi, hariIni),
    prisma.staffAttendance.findMany({ where: { userId: guru.userId, tanggal: { gte: awalPresensi, lt: akhir } }, select: { status: true, sumber: true, jamMasuk: true } }),
    prisma.teacherScheduleAttendance.findMany({ where: { date: { gte: awal, lt: akhir }, schedule: { teacherId } }, select: { status: true, hasTugas: true } }),
    susunKeterlaksanaan({ teacherId }),
    susunKelengkapan({ teacherId }),
    prisma.supervisiGuru.findMany({ where: { teacherId, tanggal: { gte: awal, lt: akhir } }, select: { jenis: true, tanggal: true, mapel: true, kelas: true, nilaiAkhir: true, predikat: true, penilaiNama: true, tindakLanjut: true }, orderBy: { tanggal: "asc" } }),
    prisma.pkbGuru.findMany({ where: { teacherId, mulai: { gte: awal, lt: akhir } }, select: { judul: true, jenis: true, penyelenggara: true, mulai: true, jamPelajaran: true }, orderBy: { mulai: "asc" } }),
    prisma.masukanRekan.groupBy({ by: ["jenis"], where: { penerimaId: guru.userId, createdAt: { gte: awal, lt: akhir } }, _count: { _all: true } }).catch(() => []),
  ]);

  // Hari sekolah sejak awal semester = semua hari bukan libur (Minggu sudah termasuk libur di `daftarLibur`).
  const jumlahHari = Math.round((akhir.getTime() - awalPresensi.getTime()) / 86400000);
  const hariSekolah = Math.max(0, jumlahHari - libur.length);
  const n = (s: string) => harian.filter(h => h.status === s).length;
  const hadir = n("HADIR");
  const blok = (s: string) => piket.filter(p => p.status === s).length;
  const tPertemuan = terlaksana.baris.reduce((t, b) => t + b.pertemuan, 0);
  const tJurnal = terlaksana.baris.reduce((t, b) => t + Math.min(b.jurnal, b.pertemuan || b.jurnal), 0);

  return {
    semester: pk.label, mulai: terlaksana.mulai, sampai: hariIni,
    guru: {
      id: guru.id, userId: guru.userId, nama: guru.user.name, nip: guru.nip, jabatan: guru.jabatan.map(j => j.jabatan.name),
      wali: guru.homeroomOf.map(k => k.name), mapel: [...new Set(terlaksana.baris.map(b => b.mapel))],
    },
    kehadiran: {
      sejak: mulaiPresensi, hariSekolah, tercatat: harian.length, hadir, izin: n("IZIN"), sakit: n("SAKIT"), dinas: n("DINAS_LUAR"), cuti: n("CUTI"), alpha: n("ALPHA"),
      turunan: harian.filter(h => h.sumber && SUMBER_TURUNAN.includes(h.sumber)).length,
      belumTercatat: Math.max(0, hariSekolah - harian.length),
      persen: hariSekolah ? Math.round((hadir / hariSekolah) * 100) : null,
    },
    kelas: {
      dicatat: piket.length, hadir: blok("HADIR"), terlambat: blok("TERLAMBAT"), izin: blok("IZIN"), sakit: blok("SAKIT"), alpha: blok("ALPHA"),
      tugas: piket.filter(p => p.status !== "HADIR" && p.status !== "TERLAMBAT" && p.hasTugas).length,
      persen: piket.length ? Math.round(((blok("HADIR") + blok("TERLAMBAT")) / piket.length) * 100) : null,
    },
    jurnal: { pertemuan: tPertemuan, terisi: tJurnal, persen: tPertemuan ? Math.round((tJurnal / tPertemuan) * 100) : null, baris: terlaksana.baris },
    perangkat: perangkat.baris,
    supervisi: supervisi.map(s => ({ ...s, tanggal: s.tanggal.toISOString().slice(0, 10) })),
    pkb: { jumlah: pkb.length, jp: pkb.reduce((t, p) => t + (p.jamPelajaran ?? 0), 0), daftar: pkb.map(p => ({ ...p, mulai: p.mulai.toISOString().slice(0, 10) })) },
    masukan: { apresiasi: 0, saran: 0, kritik: 0, ...Object.fromEntries(masukan.map(m => [m.jenis.toLowerCase(), m._count._all])) } as { apresiasi: number; saran: number; kritik: number },
  };
}
export type RaporKinerja = NonNullable<Awaited<ReturnType<typeof susunRaporKinerja>>>;
