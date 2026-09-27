import "server-only";
import { prisma } from "@/lib/prisma";
import { cekLibur } from "@/lib/hari-libur";
import { getWeekTypeForDate } from "@/lib/schedule-week.server";
import { weekTypesOverlap } from "@/lib/schedule-week";
import { getClassesMissingAttendance } from "@/lib/attendance-gaps";

/** PAPAN RUANG GURU / RUANG RAPAT (25 September 2026).
 *
 * Permintaan user: "diruang rapat itukan tempat berkumpulnya guru, gimana kalo bisa bergeser geser setiap 2 menit
 * atau berapa, untuk absensi guru dihari itu untuk ngajar agar kelihatan sudah di input atau belum, di guru piket,
 * kedisiplinan guru halaman, trus beberapa yang perlu ditampilkan lainnya."
 *
 * Papan ini SENGAJA berbeda dari papan kelas: ruang rapat & ruang guru tidak punya jadwal pelajaran, yang berguna
 * di sana adalah "apa yang hari ini belum selesai". Karena satu layar tidak cukup untuk semuanya, panelnya
 * BERGILIR (lama giliran diatur per layar, bawaan 2 menit) sementara QR presensi tetap di tempatnya.
 *
 * Batas yang dijaga:
 * - **Hanya ruang pegawai.** Isinya menyebut NAMA GURU yang belum mengisi, jadi papan jenis ini tidak boleh
 *   dipasang di TV kelas/koridor — pemilihan jenis papan ada di formulir layar, bukan otomatis.
 * - **Tidak ada data siswa per nama.** Kehadiran siswa hanya angka rekap sekolah, bukan daftar nama, sama seperti
 *   papan umum yang juga tidak pernah memuat data pribadi siswa.
 * - **Diam di hari libur.** Semua daftar "belum diisi" tidak berlaku pada hari libur; yang tersisa hanya panel
 *   agenda/pengumuman yang dirender papan umum. Sama dengan aturan pengingat terjadwal (CLAUDE.md #40).
 * - Angkanya diambil dari sumber yang SAMA dengan pengingat terjadwal & badge notifikasi
 *   (`getClassesMissingAttendance`, jadwal BLOK + minggu A/B, `TeacherScheduleAttendance`), supaya papan tidak
 *   pernah menunjukkan angka yang berbeda dari yang dilihat guru di HP-nya. */

export interface BarisPapan { utama: string; sisi?: string | null; tanda?: "perlu" | "beres" | null }
export interface OrangUlangTahun { nama: string; foto: string | null; usia: number | null; jabatan: string | null }
export interface PanelPegawai {
  kunci: string;
  judul: string;
  keterangan?: string | null;
  /** Ringkasan besar di atas daftar, mis. "18 / 24 pegawai". */
  angka?: string | null;
  baris: BarisPapan[];
  kosong: string;
  /** Lebih dari yang termuat — papan menampilkan "+N lainnya" alih-alih memotong diam-diam. */
  sisa?: number;
  /** Panel dengan tampilan khusus. Kosong = daftar baris biasa. */
  jenis?: "ULANG_TAHUN";
  orang?: OrangUlangTahun[];
}

const HARI = ["MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
/** Papan MENGGULIR daftar panjangnya pelan-pelan (lihat PapanPegawai), jadi batas ini hanya pagar terhadap
 * muatan yang tidak masuk akal — bukan lagi pemotong tampilan. Sebelumnya 8, dan guru mengeluh hanya delapan
 * nama pertama yang pernah terlihat (temuan user 25 Sep 2026). */
const BATAS_BARIS = 60;

function potong(baris: BarisPapan[]): { baris: BarisPapan[]; sisa: number } {
  return { baris: baris.slice(0, BATAS_BARIS), sisa: Math.max(0, baris.length - BATAS_BARIS) };
}

function menitDari(jam: string): number {
  const [h, m] = jam.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Panel-panel bergilir untuk satu papan ruang guru. Dipanggil dari rute layar (tanpa login, dijaga token). */
export async function susunPapanPegawai(): Promise<{ libur: string | null; panel: PanelPegawai[] }> {
  const wib = new Date(Date.now() + 7 * 3600_000);
  const tanggal = wib.toISOString().slice(0, 10);
  const hari = HARI[wib.getUTCDay()];
  const menitKini = wib.getUTCHours() * 60 + wib.getUTCMinutes();
  const awalHari = new Date(`${tanggal}T00:00:00.000Z`);
  const akhirHari = new Date(awalHari.getTime() + 86400_000);

  const libur = await cekLibur(tanggal).catch(() => null);
  if (libur) return { libur: libur.nama, panel: [] };

  const minggu = await getWeekTypeForDate(awalHari).catch(() => "SEMUA");

  const [presensi, jurnalPanel, piket, kelasBelum, siswa, ultah] = await Promise.all([
    panelPresensi(hari, minggu, awalHari),
    panelJurnal(hari, minggu, awalHari, akhirHari),
    panelPiket(hari, minggu, awalHari, akhirHari, menitKini),
    panelAbsensiKelas(awalHari),
    panelKehadiranSiswa(awalHari, akhirHari),
    panelUlangTahun(wib),
  ]);

  // Panel tanpa isi & tanpa keperluan tetap ditampilkan: papan yang menyembunyikan panel "sudah beres" membuat
  // petugas ragu apakah datanya memang bersih atau papannya gagal memuat.
  // Ulang tahun ditaruh PALING DEPAN di hari-H, dan DIHILANGKAN sama sekali bila tidak ada yang berulang tahun —
  // panel ucapan kosong yang muncul tiap hari justru melunturkan artinya.
  return { libur: null, panel: [...(ultah ? [ultah] : []), presensi, jurnalPanel, piket, kelasBelum, siswa] };
}

/** ULANG TAHUN GURU & PEGAWAI HARI INI (25 September 2026, permintaan user: "ulang tahun guru & pegawai hari
 * ini, beserta foto, dan animasi ulang tahun").
 *
 * Dicocokkan per TANGGAL & BULAN, bukan tahun — jadi tahun kelahiran tetap dipakai untuk menghitung usia. Foto
 * diambil dari avatar akun, dengan cadangan foto Buku Induk (`bukuIndukData.fotoMasukUrl`). Tanpa foto pun panel
 * tetap tampil: hurufnya dipakai sebagai lingkaran inisial di papan.
 *
 * Mengembalikan null bila tidak ada yang berulang tahun — pemanggilnya menghilangkan panelnya sama sekali. */
async function panelUlangTahun(wib: Date): Promise<PanelPegawai | null> {
  const tgl = wib.getUTCDate();
  const bulan = wib.getUTCMonth() + 1;

  const guru = await prisma.teacher.findMany({
    where: { birthDate: { not: null }, user: { role: { in: ["TEACHER", "TAS"] } } },
    select: {
      birthDate: true, position: true, bukuIndukData: true,
      user: { select: { name: true, avatar: true } },
    },
  }).catch(() => []);

  const hariIni = guru.filter(g => {
    if (!g.birthDate) return false;
    const d = g.birthDate;
    return d.getUTCDate() === tgl && d.getUTCMonth() + 1 === bulan;
  });
  if (!hariIni.length) return null;

  const orang: OrangUlangTahun[] = hariIni.map(g => {
    const data = g.bukuIndukData as Record<string, unknown> | null;
    const fotoBukuInduk = typeof data?.fotoMasukUrl === "string" ? data.fotoMasukUrl : null;
    const tahun = g.birthDate!.getUTCFullYear();
    return {
      nama: g.user.name,
      foto: g.user.avatar || fotoBukuInduk || null,
      usia: tahun > 1900 ? wib.getUTCFullYear() - tahun : null,
      jabatan: g.position || null,
    };
  }).sort((a, b) => a.nama.localeCompare(b.nama, "id"));

  return {
    kunci: "ulang-tahun",
    judul: orang.length === 1 ? "Selamat ulang tahun!" : `Selamat ulang tahun — ${orang.length} orang`,
    keterangan: "Semoga sehat, berkah, dan bahagia selalu",
    angka: null,
    baris: [],
    kosong: "",
    jenis: "ULANG_TAHUN",
    orang,
  };
}

/** Presensi GURU YANG MENGAJAR HARI ITU — bukan seluruh pegawai sekolah.
 *
 * Permintaan user 25 Sep 2026: "kita ubah saja presensi ini muncul guru-guru yang mengajar di hari itu saja."
 * Versi pertama menampilkan 37 pegawai, termasuk yang memang tidak ada jadwal hari itu, sehingga "belum tercatat"
 * di papan tidak berarti apa-apa. Cakupannya sekarang sama dengan jadwal BLOK hari itu pada minggu berjalan —
 * sumber yang sama dengan panel Jurnal dan Buku Piket, jadi ketiganya tidak pernah berbeda isi. */
async function panelPresensi(hari: string, minggu: string, awalHari: Date): Promise<PanelPegawai> {
  const jadwal = await prisma.schedule.findMany({
    where: { day: hari, scheduleType: "BLOK", teacherId: { not: null } },
    select: { weekType: true, teacher: { select: { userId: true, user: { select: { name: true } } } } },
  }).catch(() => []);

  const guru = new Map<string, string>();
  for (const j of jadwal) {
    if (!j.teacher || !weekTypesOverlap(j.weekType, minggu)) continue;
    guru.set(j.teacher.userId, j.teacher.user.name);
  }
  if (!guru.size) {
    return {
      kunci: "presensi", judul: "Presensi guru hari ini",
      keterangan: null, angka: null, baris: [],
      kosong: "Tidak ada guru yang mengajar hari ini.",
    };
  }

  const catatan = await prisma.staffAttendance.findMany({
    where: { tanggal: awalHari, userId: { in: [...guru.keys()] } },
    select: { userId: true, status: true, jamMasuk: true },
  }).catch(() => []);
  const peta = new Map(catatan.map(c => [c.userId, c]));

  const daftar: BarisPapan[] = [...guru].map(([userId, nama]) => {
    const c = peta.get(userId);
    return {
      utama: nama,
      sisi: c ? `${c.status}${c.jamMasuk ? ` · ${c.jamMasuk}` : ""}` : "belum tercatat",
      tanda: c ? ("beres" as const) : ("perlu" as const),
    };
  });
  // Yang belum tercatat didahulukan; di dalam tiap kelompok tetap urut nama supaya mudah dicari mata.
  daftar.sort((a, b) =>
    Number(a.tanda === "beres") - Number(b.tanda === "beres") || a.utama.localeCompare(b.utama, "id"));
  const { baris, sisa } = potong(daftar);

  return {
    kunci: "presensi",
    judul: "Presensi guru hari ini",
    keterangan: "Guru yang mengajar hari ini — bisa langsung pindai QR di samping",
    angka: `${catatan.length} / ${guru.size}`,
    baris, sisa,
    kosong: "Semua guru yang mengajar hari ini sudah tercatat.",
  };
}

/** Guru yang mengajar hari ini tetapi jurnalnya belum diisi — logika sama dengan pengingat terjadwal
 * (dicocokkan per guru + KELAS, bukan nama mapel, supaya perbedaan penulisan mapel tidak memicu salah hitung). */
async function panelJurnal(hari: string, minggu: string, awalHari: Date, akhirHari: Date): Promise<PanelPegawai> {
  const jadwal = await prisma.schedule.findMany({
    where: { day: hari, scheduleType: "BLOK", teacherId: { not: null } },
    select: { teacherId: true, classId: true, weekType: true, class: { select: { name: true } }, teacher: { select: { user: { select: { name: true } } } } },
  }).catch(() => []);

  const perGuru = new Map<string, { nama: string; kelas: Map<string, string> }>();
  for (const j of jadwal) {
    if (!j.teacherId || !j.teacher || !weekTypesOverlap(j.weekType, minggu)) continue;
    const g = perGuru.get(j.teacherId) ?? { nama: j.teacher.user.name, kelas: new Map<string, string>() };
    g.kelas.set(j.classId, j.class.name);
    perGuru.set(j.teacherId, g);
  }

  let total = 0, terisi = 0;
  const daftar: BarisPapan[] = [];
  if (perGuru.size) {
    const jurnal = await prisma.teachingJournal.findMany({
      where: { date: { gte: awalHari, lt: akhirHari }, teacherId: { in: [...perGuru.keys()] } },
      select: { teacherId: true, classId: true },
    }).catch(() => []);
    const ada = new Set(jurnal.map(j => `${j.teacherId}|${j.classId}`));
    for (const [teacherId, g] of perGuru) {
      const belum = [...g.kelas].filter(([classId]) => !ada.has(`${teacherId}|${classId}`)).map(([, nama]) => nama);
      total += g.kelas.size;
      terisi += g.kelas.size - belum.length;
      if (belum.length) daftar.push({ utama: g.nama, sisi: belum.join(", "), tanda: "perlu" });
    }
  }
  daftar.sort((a, b) => a.utama.localeCompare(b.utama, "id"));
  const { baris, sisa } = potong(daftar);

  return {
    kunci: "jurnal",
    judul: "Jurnal mengajar belum diisi",
    keterangan: "Kelas yang diajar hari ini tetapi jurnalnya belum masuk",
    angka: total ? `${terisi} / ${total} pertemuan` : null,
    baris, sisa,
    kosong: total ? "Semua jurnal hari ini sudah diisi." : "Tidak ada jadwal mengajar hari ini.",
  };
}

/** Buku piket: SIAPA mengajar DI KELAS MANA jam ini, dan sudah tercatat masuk atau belum.
 *
 * Permintaan user 25 Sep 2026: "harusnya terlihat nama-nama dan kelasnya, sudah masuk kelas atau belum."
 * Versi pertama hanya menampilkan angka ("14 jam pelajaran belum diisi") — benar, tetapi tidak bisa ditindaklanjuti
 * dari seberang ruangan. Cakupannya sama dengan modul Buku Piket: kelas X & XI, jadwal BLOK, minggu berjalan,
 * dan hanya jam yang SUDAH berjalan (jam yang belum mulai bukan "belum diisi", itu belum waktunya). */
async function panelPiket(hari: string, minggu: string, awalHari: Date, akhirHari: Date, menitKini: number): Promise<PanelPegawai> {
  const [roster, jadwal] = await Promise.all([
    prisma.dutyRoster.findMany({ where: { day: hari }, select: { weekType: true, user: { select: { name: true } } } }).catch(() => []),
    prisma.schedule.findMany({
      where: { day: hari, scheduleType: "BLOK", teacherId: { not: null }, class: { grade: { in: [10, 11] } } },
      select: {
        id: true, startTime: true, endTime: true, weekType: true,
        class: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
      },
      orderBy: { startTime: "asc" },
    }).catch(() => []),
  ]);

  const petugas = [...new Set(roster.filter(r => weekTypesOverlap(r.weekType, minggu)).map(r => r.user.name))];
  const berjalan = jadwal.filter(j => weekTypesOverlap(j.weekType, minggu) && menitDari(j.startTime) <= menitKini);

  const catatan = berjalan.length
    ? await prisma.teacherScheduleAttendance.findMany({
        where: { scheduleId: { in: berjalan.map(j => j.id) }, date: { gte: awalHari, lt: akhirHari } },
        select: { scheduleId: true, status: true },
      }).catch(() => [])
    : [];
  const peta = new Map(catatan.map(c => [c.scheduleId, c.status]));
  const terisi = catatan.length;

  const daftar: BarisPapan[] = berjalan.map(j => {
    const status = peta.get(j.id);
    const sedang = menitDari(j.startTime) <= menitKini && menitKini < menitDari(j.endTime);
    return {
      utama: `${j.class.name} — ${j.teacher?.user.name ?? "belum ada guru"}`,
      sisi: `${j.startTime} · ${status ?? "belum diisi"}${sedang ? " · jam ini" : ""}`,
      // Hanya HADIR yang dianggap beres; TERLAMBAT/IZIN/SAKIT/ALPHA & yang belum diisi sama-sama perlu dilihat.
      tanda: status === "HADIR" ? ("beres" as const) : ("perlu" as const),
    };
  });
  // Yang sedang berjalan & yang belum diisi didahulukan — itu yang bisa ditindaklanjuti saat itu juga.
  daftar.sort((a, b) => Number(b.sisi?.includes("jam ini")) - Number(a.sisi?.includes("jam ini")));
  const { baris, sisa } = potong(daftar);

  return {
    kunci: "piket",
    judul: "Buku piket hari ini",
    keterangan: petugas.length ? `Petugas piket: ${petugas.join(", ")}` : "Belum ada petugas piket terjadwal hari ini",
    angka: berjalan.length ? `${terisi} / ${berjalan.length}` : null,
    baris, sisa,
    kosong: "Belum ada jam pelajaran yang berjalan hari ini.",
  };
}

/** Kelas yang belum diabsen wali kelasnya — sumber sama dengan badge "Kelas Belum Absen". */
async function panelAbsensiKelas(awalHari: Date): Promise<PanelPegawai> {
  const kelas = await getClassesMissingAttendance(awalHari).catch(() => []);
  const total = await prisma.class.count({ where: { homeroomId: { not: null }, students: { some: { studentStatus: "AKTIF" } } } }).catch(() => 0);
  const { baris, sisa } = potong(kelas.map(k => ({
    utama: k.name,
    sisi: k.homeroom?.user.name ?? "belum ada wali kelas",
    tanda: "perlu" as const,
  })));

  return {
    kunci: "absensi",
    judul: "Absensi kelas belum diisi",
    keterangan: "Wali kelas yang belum mengisi absensi hari ini",
    angka: total ? `${total - kelas.length} / ${total} kelas` : null,
    baris, sisa,
    kosong: "Semua kelas sudah diabsen hari ini.",
  };
}

/** Rekap kehadiran siswa hari ini — ANGKA saja, tanpa nama siswa (papan tetap tidak memuat data pribadi). */
async function panelKehadiranSiswa(awalHari: Date, akhirHari: Date): Promise<PanelPegawai> {
  const [rekap, aktif] = await Promise.all([
    prisma.attendance.groupBy({
      by: ["status"],
      where: { date: { gte: awalHari, lt: akhirHari }, student: { studentStatus: "AKTIF" } },
      _count: { _all: true },
    }).catch(() => [] as { status: string; _count: { _all: number } }[]),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
  ]);

  const peta = new Map(rekap.map(r => [r.status, r._count._all]));
  const tercatat = [...peta.values()].reduce((a, b) => a + b, 0);
  const urut: { status: string; label: string }[] = [
    { status: "HADIR", label: "Hadir" },
    { status: "IZIN", label: "Izin" },
    { status: "SAKIT", label: "Sakit" },
    { status: "ALPHA", label: "Tanpa keterangan" },
  ];
  const baris: BarisPapan[] = urut.map(u => ({
    utama: u.label,
    sisi: `${peta.get(u.status) ?? 0} siswa`,
    tanda: u.status === "ALPHA" && (peta.get("ALPHA") ?? 0) > 0 ? "perlu" : null,
  }));

  return {
    kunci: "siswa",
    judul: "Kehadiran siswa hari ini",
    keterangan: aktif ? `${tercatat} dari ${aktif} siswa aktif sudah tercatat` : null,
    angka: aktif ? `${Math.round((tercatat / aktif) * 100)}%` : null,
    baris,
    kosong: "Belum ada absensi yang masuk hari ini.",
  };
}
