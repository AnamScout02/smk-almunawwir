export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/site-settings";
import PapanLayar, { type IsiPapan } from "@/components/sarpras/PapanLayar";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { kutipanHariIni, peringkatKedisiplinan, perluPerhatian } from "@/lib/papan-kelas";
import { modeBelBerlaku, profilBelHariIni } from "@/lib/bel-profil";

/** PAPAN INFORMASI TV (24 September 2026) — halaman yang ditampilkan TV saat menganggur.
 *
 * TIDAK butuh login: TV tidak bisa mengetik sandi. Yang menjaga adalah **token acak per layar** yang dibuat
 * petugas dari halaman Papan & TV, dan isinya sengaja hanya hal yang memang pantas terpampang di dinding kelas —
 * jadwal pelajaran, agenda sekolah, dan pengumuman yang ditujukan ke SEMUA/siswa. Tidak ada data pribadi siswa,
 * tidak ada nilai, tidak ada absensi per nama.
 *
 * Halaman ini juga dipakai nanti oleh aplikasi TV (WebView) sebagai layar menganggur; sekarang sudah bisa dibuka
 * dari perangkat apa pun yang punya browser. */
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const layar = await prisma.layar.findUnique({
    where: { token },
    select: {
      nama: true, ruang: true, papanJudul: true, papanIsi: true, papanManualSaja: true, papanCara: true, papanQr: true,
      papanJenis: true, papanGiliran: true, volumeBel: true, belMode: true, belModeSampai: true,
      kelas: { select: { id: true, name: true } },
    },
  }).catch(() => null);
  if (!layar) notFound();

  const wib = new Date(Date.now() + 7 * 3600_000);
  const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const hari = HARI[wib.getUTCDay()];
  const hariIni = wib.toISOString().slice(0, 10);

  // MINGGU A/B & BLOK — tanpa penyaring ini papan menumpuk tiga pelajaran di jam yang sama: satu baris NONBLOK
  // (unggahan Dapodik) ditambah baris minggu A dan minggu B sekaligus (temuan user 25 Sep 2026: "kok ada 3
  // 07.15?"). Penyaringnya sama persis dengan yang dipakai Jurnal, Buku Piket, dan pengingat terjadwal.
  const minggu = await getWeekTypeForDate(new Date(`${hariIni}T00:00:00.000Z`)).catch(() => "SEMUA");

  const [jadwal, pengumuman, agenda, setelan, bel] = await Promise.all([
    /* DUA JENIS JADWAL (25 September 2026, pertanyaan user: "lab itu kan dipakai banyak kelas yang berbeda").
       - TV di depan KELAS (punya `kelasId`): jadwal kelas itu.
       - TV di LAB/ruang bersama (tanpa kelas): jadwal RUANG itu — siapa pun yang memakainya hari ini, lengkap
         dengan nama kelasnya. Memaksa lab terikat satu kelas membuat papannya berbohong sepanjang hari, karena
         kelas lain yang sedang memakai lab tidak pernah muncul. */
    prisma.schedule.findMany({
      where: layar.kelas
        ? { classId: layar.kelas.id, day: hari, scheduleType: "BLOK" }
        : { room: layar.ruang, day: hari, scheduleType: "BLOK" },
      orderBy: { startTime: "asc" },
      select: {
        subject: true, startTime: true, endTime: true, room: true, weekType: true,
        class: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
      },
    }).then(r => r.filter(j => weekTypesOverlap(j.weekType, minggu))).catch(() => []),
    // Hanya pengumuman yang memang pantas terpampang di dinding: sasaran umum/siswa, sedang berlaku.
    prisma.announcement.findMany({
      where: {
        active: true,
        startDate: { lte: new Date() },
        targetRole: { in: ["ALL", "STUDENT", "STUDENT_PARENT"] },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
      orderBy: [{ priority: "desc" }, { startDate: "desc" }],
      take: 5,
      select: { title: true, content: true },
    }).catch(() => []),
    prisma.schoolEvent.findMany({
      where: { tanggalSelesai: { gte: new Date(`${hariIni}T00:00:00.000Z`) }, tampilPublik: true },
      orderBy: { tanggalMulai: "asc" },
      take: 5,
      select: { judul: true, tanggalMulai: true, jenis: true },
    }).catch(() => []),
    getSettings([
      "school.name", "logo.full_white", "logo.full",
      ...[1, 2, 3, 4, 5].flatMap(n => [`papan.kutipan${n}_arabic`, `papan.kutipan${n}_trans`, `papan.kutipan${n}_source`]),
    ]).catch(() => ({} as Record<string, string>)),
    // Jadwal bel hari ini — panel keempat papan. Diambil di server supaya TV tidak perlu izin apa pun.
    prisma.bellSchedule.findMany({
      where: { active: true },
      orderBy: { time: "asc" },
      select: { label: true, time: true, days: true, audioUrl: true, profil: true },
    }).catch(() => []),
  ]);

  /* BEL YANG BERLAKU (4 Okt 2026, src/lib/bel-profil.ts): profil hari ini (Reguler / Ujian pada tanggal Kegiatan
     Ujian), ditimpa mode TV ini — HENING tidak membunyikan apa pun, UJIAN selalu memakai bel ujian (ruang
     ANBK/TKA). TV "ikut bel ujian" saat TU belum menyusun bel ujian tetap memakai bel reguler, bukan diam. */
  const modeBel = modeBelBerlaku(layar);
  const { profil: profilSekolah } = await profilBelHariIni().catch(() => ({ profil: "REGULER" as const }));
  const adaBelUjian = bel.some(b => b.profil === "UJIAN");
  const profilTv = modeBel === "UJIAN" && adaBelUjian ? "UJIAN" : profilSekolah;

  // Halaman kedua papan kelas (kutipan harian, peringkat kedisiplinan, siswa perlu diperhatikan). Keduanya
  // dibungkus .catch sendiri: papan tidak boleh gagal total hanya karena satu panel tambahan bermasalah.
  const [peringkat, perhatian] = await Promise.all([
    peringkatKedisiplinan(wib).catch(() => []),
    perluPerhatian(layar.kelas?.id ?? null, wib).catch(() => ({ siswa: [], rekap: { hadir: 0, izin: 0, sakit: 0, alpha: 0 } })),
  ]);

  const isi: IsiPapan = {
    token, modeQr: layar.papanQr,
    jenis: layar.papanJenis, giliran: layar.papanGiliran, volumeBel: layar.volumeBel,
    manualJudul: layar.papanJudul,
    manualIsi: layar.papanIsi,
    manualSaja: layar.papanManualSaja,
    // Mode pengumuman (TEKS / SUARA / TEKS_SUARA) WAJIB ikut muatan awal — lihat PapanLayar.
    manualCara: layar.papanCara,
    namaLayar: layar.nama,
    ruang: layar.ruang,
    kelas: layar.kelas?.name ?? null,
    namaSekolah: setelan["school.name"] ?? "SMK Al-Munawwir IIBS",
    // Logo versi PANJANG (berikut tulisan nama sekolah) di atas latar navy — permintaan user 24 Sep 2026.
    logo: setelan["logo.full_white"] || setelan["logo.full"] || null,
    jadwal: jadwal.map(j => ({
      mapel: j.subject, mulai: j.startTime, selesai: j.endTime,
      guru: j.teacher?.user.name ?? null, ruang: j.room ?? null, kelas: j.class?.name ?? null,
    })),
    pengumuman: pengumuman.map(p => ({ judul: p.title, isi: p.content.slice(0, 400) })),
    agenda: agenda.map(a => ({ judul: a.judul, tanggal: a.tanggalMulai.toISOString(), jenis: a.jenis })),
    kutipan: kutipanHariIni(setelan, wib),
    peringkat,
    perluPerhatian: perhatian.siswa,
    rekapKelas: perhatian.rekap,
    bel: bel
      .filter(b => (b.profil || "REGULER") === profilTv)
      // Bel ujian juga mengikuti hari yang dicentang TU (Jumat lazim punya jam sesi berbeda).
      .filter(b => b.days.split(",").map(d => d.trim()).includes(hari))
      .map(b => ({ label: b.label, jam: b.time, audioUrl: b.audioUrl })),
    belHening: modeBel === "HENING",
    profilBel: profilTv,
  };

  return <PapanLayar isi={isi} />;
}
