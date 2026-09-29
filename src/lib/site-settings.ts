import { prisma } from "./prisma";

export const DEFAULTS: Record<string, string> = {
  // Keamanan sesi: peran yang dibatasi satu perangkat aktif (JSON array) — lihat sesi-server.ts
  "auth.sesiTunggal": "[]",
  // Tingkat kelas yang jam mengajarnya dipantau guru piket (Buku Piket, skor kedisiplinan).
  // Kelas XII dikecualikan selama sedang PKL — lihat src/lib/kehadiran-guru.ts.
  "kedisiplinan.tingkat": "10,11",
  // Pendaftaran PKL: siswa kelas XI pada SEMESTER GENAP, sebelum naik ke kelas XII (aturan
  // sekolah). Tingkatnya & jendela waktunya diatur di sini, bukan tertulis mati di route seperti
  // dulu — lihat src/lib/pkl-pendaftar.ts. `pendaftaranDibuka`: auto (ikut semester genap) |
  // buka (paksa buka, mis. gelombang tambahan) | tutup.
  "pkl.tingkatPendaftar": "11",
  "pkl.pendaftaranDibuka": "auto",
  // Ayat & Hadis
  "islamic.cta_arabic": "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا",
  "islamic.cta_trans": "Dan barangsiapa bertakwa kepada Allah, niscaya Dia akan membukakan jalan keluar baginya.",
  "islamic.cta_source": "QS. Ath-Thalaq: 2",
  "islamic.footer_arabic": "النور يهدي إلى النور",
  "islamic.login_arabic": "اقْرَأْ بِاسْمِ رَبِّكَ",
  "islamic.login_label": "Iqra' Bismi Rabbik",
  // KUTIPAN PAPAN TV — SENGAJA TERPISAH dari kutipan situs web (permintaan user 25 Sep 2026: "khusus, tidak sama
  // seperti yang untuk web"). Papan dibaca sambil lalu oleh siswa di kelas, sedangkan kutipan web ditulis untuk
  // calon wali murid; nada dan panjangnya berbeda. Papan memakai satu kutipan per hari, bergilir menurut tanggal.
  "papan.kutipan1_arabic": "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ",
  "papan.kutipan1_trans": "Menuntut ilmu itu wajib atas setiap muslim.",
  "papan.kutipan1_source": "HR. Ibnu Majah",
  "papan.kutipan2_arabic": "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ",
  "papan.kutipan2_trans": "Siapa menempuh jalan untuk mencari ilmu, Allah mudahkan baginya jalan menuju surga.",
  "papan.kutipan2_source": "HR. Muslim",
  "papan.kutipan3_arabic": "وَقُل رَّبِّ زِدْنِي عِلْمًا",
  "papan.kutipan3_trans": "Dan katakanlah: Ya Tuhanku, tambahkanlah kepadaku ilmu pengetahuan.",
  "papan.kutipan3_source": "QS. Thaha: 114",
  "papan.kutipan4_arabic": "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
  "papan.kutipan4_trans": "Sesungguhnya bersama kesulitan ada kemudahan.",
  "papan.kutipan4_source": "QS. Al-Insyirah: 6",
  "papan.kutipan5_arabic": "خَيْرُ النَّاسِ أَنْفَعُهُمْ لِلنَّاسِ",
  "papan.kutipan5_trans": "Sebaik-baik manusia adalah yang paling bermanfaat bagi manusia lain.",
  "papan.kutipan5_source": "HR. Ahmad",
  "islamic.quote1_arabic": "اقْرَأْ بِاسْمِ رَبِّكَ الَّذِي خَلَقَ",
  "islamic.quote1_trans": "Bacalah dengan nama Tuhanmu yang menciptakan.",
  "islamic.quote1_source": "QS. Al-Alaq: 1",
  "islamic.quote2_arabic": "طَلَبُ الْعِلْمِ فَرِيضَةٌ عَلَى كُلِّ مُسْلِمٍ",
  "islamic.quote2_trans": "Menuntut ilmu adalah kewajiban bagi setiap Muslim.",
  "islamic.quote2_source": "HR. Ibn Majah",
  "islamic.quote3_arabic": "مَنْ سَلَكَ طَرِيقًا يَلْتَمِسُ فِيهِ عِلْمًا سَهَّلَ اللَّهُ لَهُ طَرِيقًا إِلَى الْجَنَّةِ",
  "islamic.quote3_trans": "Barangsiapa menempuh jalan untuk mencari ilmu, Allah mudahkan jalan menuju surga.",
  "islamic.quote3_source": "HR. Muslim",
  // Logo
  "logo.emblem": "/images/logo-emblem.png",
  "logo.full": "/images/logo-full.png",
  "logo.full_white": "/images/logo-full-white.png",
  // Kop Surat Cetak Buku Induk
  "letterhead.bukuInduk": "",
  "letterhead.kopBawah": "", // footer/kop bawah — Notulen Rapat, Surat Keluar, dokumen resmi lain
  // Statistik
  "stats.students": "1200",
  "stats.achievements": "50",
  "stats.graduation_rate": "98",
  "stats.years": "12",
  "stats.partners": "30",
  "stats.founded_year": "2014",
  // Fasilitas (angka yang tidak punya sumber data live di DB — fakta fisik kampus)
  "facilities.labs": "6",
  "facilities.dormitory_capacity": "800",
  "facilities.campus_area": "10 Ha",
  // Prestasi ekstrakurikuler — dikelola admin lewat Konten Halaman, bukan hardcode kode
  "ekskul.achievements": JSON.stringify([
    { event: "Juara 1 LKS TKJ", scope: "Tingkat Kabupaten", year: "2024" },
    { event: "Juara 2 Kaligrafi", scope: "Tingkat Provinsi", year: "2024" },
    { event: "Juara 1 Futsal", scope: "Turnamen Pesantren Se-Jatim", year: "2023" },
    { event: "Best Speaker English Debate", scope: "Tingkat Kabupaten", year: "2023" },
    { event: "Juara 3 Tahfidz 10 Juz", scope: "MTQ Pelajar Provinsi", year: "2024" },
    { event: "Juara 1 LKS DKV", scope: "Tingkat Kabupaten", year: "2023" },
  ]),
  // Banner CTA
  "cta.title": "Bergabunglah Bersama Kami",
  "cta.ppdb_year": "2026/2027",
  "cta.subtitle": "SPMB 2026/2027 kini dibuka. Jadikan anak Anda bagian dari generasi Qurani yang terampil dan berdaya saing global.",
  "cta.sub_note": "Kuota terbatas · Tersedia beasiswa prestasi & tahfidz",
  // Kontak
  "contact.phone": "0838-7820-3670",
  "contact.email": "smkalmunawwir@gmail.com",
  "contact.address": "Jl. Kedungliwung No. 36, Ds. Kemiri, Kec. Singojuruh, Banyuwangi, Jawa Timur",
  "contact.hours_main": "Sen–Kam & Sab: 06.45–14.00",
  "contact.hours_friday": "Jumat: 06.45–13.00",
  // Info Sekolah
  "school.tagline": "Mendidik Generasi Qurani & Terampil",
  "school.hero_subtitle": "Memadukan kurikulum vokasional nasional dengan pendidikan Islam intensif — menyiapkan generasi berakhlak mulia dan siap dunia kerja global.",
  // Keunggulan Kami (beranda) — bahasa Indonesia, diubah lewat Konten Halaman. Bahasa Inggris memakai translations.ts.
  "why.label": "Keunggulan Kami",
  "why.heading": "Kenapa Memilih SMK Al Munawwir IIBS?",
  "why.sub": "Perpaduan pendidikan vokasi berstandar industri dengan pembinaan karakter Islami sepanjang hari.",
  "why.1_title": "Boarding 24 Jam",
  "why.1_desc": "Pembinaan akhlak & kemandirian sepanjang hari dalam lingkungan pesantren modern.",
  "why.2_title": "Vokasi + Tahfidz",
  "why.2_desc": "Kompetensi keahlian industri dipadukan program tahfidz Al-Qur'an terjadwal.",
  "why.3_title": "Guru Berpengalaman",
  "why.3_desc": "Tenaga pendidik profesional dan bersertifikat di bidang keahliannya masing-masing.",
  "why.4_title": "PKL & Mitra Industri",
  "why.4_desc": "Praktik kerja lapangan nyata bersama mitra dunia usaha & dunia industri (DU/DI).",
  "why.5_title": "Fasilitas Lengkap",
  "why.5_desc": "Laboratorium komputer, bengkel praktik, dan asrama yang representatif.",
  "why.6_title": "Lingkungan Qurani",
  "why.6_desc": "Nilai-nilai Islam tertanam dalam keseharian, bukan sekadar mata pelajaran.",
  "school.struktur_year": "2025/2026",
  "school.kode": "026", // kode sekolah, dipakai di format nomor surat otomatis

  // SPMB — bobot skor otomatis (persen, total wajar 100 tapi tidak divalidasi ketat)
  "spmb.bobotRapor": "60",
  "spmb.bobotTes": "40",
  // Pendaftaran (SPMB) — dipakai di halaman Pendaftaran
  "admissions.open_date": "2026-06-01",
  "admissions.close_date": "2026-08-31",
  "admissions.quota": "200",
  // Struktur Pimpinan — dipakai di halaman Tentang Kami & tanda tangan Kepala Sekolah pada cetak Buku Induk Siswa
  "school.structure": JSON.stringify([
    { role: "Kepala Sekolah", name: "Ahmad Azmi Khoirul Umam, S.Pt, M.Pt, M.Sc", highlight: true },
    { role: "Waka Bid. Kurikulum", name: "Soleh Afandi, S.Pd" },
    { role: "Waka Bid. Kesiswaan", name: "Miftahul Huda, S.Pd" },
    { role: "Waka Bid. Humas", name: "Eko Supriyono, S.Sos" },
    { role: "Waka Bid. Sarpras", name: "Bagus Ramadhan, S.Tr.Pt" },
    { role: "Waka Bid. Penjamin Mutu", name: "Mohammad Sholeh Mubarok, S.Pd., S.S.Ag" },
  ]),
  // Kepala Kompetensi Keahlian — dipakai di halaman Tentang Kami
  "school.kaprodi": JSON.stringify([
    { code: "TKJ", name: "Rita Defiana, S.Pd" },
    { code: "AK", name: "Nur Hidayah, SE" },
    { code: "DKV", name: "Anggun Ahmad Shodikin, S.Sos" },
    { code: "ATU", name: "Wahyu Fitri Yani, S.Tr.Pt" },
    { code: "DPIB", name: "Virga Ahmad Fauzi, S.T" },
  ]),
  // Konfigurasi form pendaftaran — "1" = wajib, "0" = opsional, "off" = sembunyikan
  "form.require_nik": "1",
  "form.require_nisn": "1",
  "form.require_address": "1",
  "form.require_guardian": "1",
  "form.require_ijazah": "1",
  "form.require_kk": "1",
  "form.require_ktp_wali": "0",
  "form.require_foto": "0",
  "form.require_dokumen_lain": "0",
  // Jadwal Pelajaran — kunci supaya Generate Otomatis & Hapus Hasil Generate tidak bisa dipakai
  // tanpa sengaja setelah jadwal dianggap final
  "schedule.locked": "0",
  // Perpustakaan — denda keterlambatan per hari (Rupiah), 0 = tidak ada denda
  "perpustakaan.dendaPerHari": "500",
  "perpustakaan.maksPinjamAktif": "3", // batas buku dipinjam bersamaan per anggota (Meja Sirkulasi)
  "perpustakaan.maksReservasi": "2", // batas pesanan aktif per anggota (Katalog anggota)
  // Notifikasi push (src/lib/pengingat-terjadwal.ts) — jam WIB dipisah koma; tanggal libur YYYY-MM-DD dipisah koma.
  // Absen mandiri pindai QR (src/lib/absensi-qr.ts) — jam WIB.
  "absensiQr.jamBuka": "05:30",
  "absensiQr.jamTutup": "10:00",
  "notifikasi.aktif": "1",
  "notifikasi.jamAbsensi": "07:30,09:30",
  "notifikasi.jamPiket": "09:00,12:00",
  "notifikasi.jamJurnal": "14:30",
  "notifikasi.tanggalLibur": "",
  "notifikasi.liburNasional": "1", // ikuti tanggal merah nasional (src/lib/hari-libur.ts)
  "libur.nasional": "", // salinan tanggal merah nasional (JSON) — diperbarui otomatis tiap minggu
  "notifikasi.jamPeringatanDini": "07:15", // hanya hari Senin
  "notifikasi.jamPerpustakaan": "06:45", // jatuh tempo besok & terlambat 1/3/7 hari
  "notifikasi.jamRekapKelas": "10:00", // rekap kehadiran harian ke wali kelas (17 Sep 2026)
  "notifikasi.jamRingkasanOrtu": "16:00", // ringkasan mingguan ke orang tua tiap Sabtu (17 Sep 2026)
  // Cek Kelulusan — jadwal buka/tutup halaman publik, kosong = selalu buka
  "kelulusan.tanggalBuka": "",
  "kelulusan.tanggalTutup": "",

  // Nominatif Kelas XII (UKK/USP) — data administratif yang TIDAK bisa dihitung dari data
  // siswa (identitas pejabat penandatangan, kode sekolah resmi Dinas, info server ujian).
  // Diedit langsung di halaman /dashboard/admin/nominatif (NominatifManager.tsx), bukan di
  // Konten Halaman — keputusan eksplisit user 2026-09-11.
  "nominatif.pengawasNama": "",
  "nominatif.pengawasNip": "",
  "nominatif.dinasNama": "",
  "nominatif.dinasNip": "",
  "nominatif.dinasPangkat": "",
  "nominatif.dinasWilayah": "",
  "nominatif.nss": "",
  "nominatif.npsn": "",
  "nominatif.kdProp": "",
  "nominatif.kdRayon": "",
  "nominatif.kdSekolah": "",
  "nominatif.statusAkreditasiSekolah": "",
  "nominatif.kecamatan": "",
  "nominatif.kabKota": "",
  "nominatif.kodePos": "",
  "nominatif.jumlahServerUtama": "1",
  "nominatif.jumlahServerCadangan": "1",
  "nominatif.tempatUjian": "",
  // JSON: { "<AcademicYear.name>": { "<Major.code>": <pagu number> } } — satu-satunya angka
  // Pagu PPDB yang genuinely tidak bisa diturunkan dari data pendaftar (target sebelum
  // pendaftaran terjadi), diedit per jurusan per tahun ajaran di halaman yang sama.
  "nominatif.pagu": "{}",

  // Pengaturan Ujian (CBT) — nilai BAWAAN untuk ujian yang baru dibuat, diedit proktor/kurikulum
  // di /pusat-ujian/pengaturan. Ujian yang sudah ada tidak ikut berubah. "1"/"0" = ya/tidak.
  "ujian.durasiBawaan": "90",
  "ujian.acakSoal": "1",
  "ujian.acakOpsi": "1",
  "ujian.satuSoalPerHalaman": "1",
  "ujian.tampilkanNilai": "0",
  "ujian.batasPindahTab": "0",
  // Token ujian berganti otomatis tiap N menit (0 = tidak) & batas putar audio listening per
  // soal (0 = bebas) — dua-duanya bawaan ujian baru.
  "ujian.tokenOtomatisMenit": "0",
  // Safe Exam Browser — Browser Exam Key & Config Key dari SEB Configuration Tool di komputer
  // sekolah (server ini tidak membangkitkannya). Kosong = pemeriksaan SEB dilewati.
  "ujian.sebKunci": "",
  "ujian.sebConfigKey": "",
  "ujian.pinAplikasi": "", // PIN keluar Aplikasi Ujian Android saat mengerjakan (kosong = cukup konfirmasi)
  "ujian.batasPutarAudio": "0",
  // Alat bantu di layar peserta untuk ujian baru: kalkulator ilmiah & kertas coretan digital.
  "ujian.izinKalkulator": "0",
  "ujian.izinCoretan": "1",
  // Pengerjaan DIKUNCI kalau siswa terputus (tanpa denyut) lebih dari N menit, lalu harus dibuka
  // pengawas. 0 = tidak pernah dikunci otomatis. Berlaku untuk SEMUA ujian.
  "ujian.kunciTerputusMenit": "0",
  // Petunjuk tambahan dari sekolah yang tampil di halaman Konfirmasi peserta (kosong = tidak ada).
  "ujian.petunjukTambahan": "",
};

export async function getSettings(keys?: string[]): Promise<Record<string, string>> {
  // Build result with defaults first
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (!keys || keys.includes(k)) result[k] = v;
  }
  // Override with DB values (fallback to defaults if DB unavailable)
  try {
    const where = keys ? { key: { in: keys } } : undefined;
    const rows = await prisma.siteSetting.findMany({ where });
    for (const row of rows) {
      result[row.key] = row.value;
    }
  } catch {
    // prisma client not ready or DB unavailable — use defaults above
  }
  return result;
}

/** Nama pejabat yang di-highlight di "school.structure" (default: Kepala Sekolah) — dipakai
 * sbg penanda tangan dokumen resmi. Duplikat kecil dari helper yang sudah ada di beberapa
 * halaman cetak (persuratan, notulen-rapat, dll — lihat masing2 kalau perlu diseragamkan),
 * disalin ke sini supaya konsumen baru (mis. Kartu Tanda) tidak perlu re-implement parsing-nya. */
export function getPrincipalName(structureJson: string): string {
  try {
    const parsed = JSON.parse(structureJson || "[]") as { role: string; name: string; highlight?: boolean }[];
    return parsed.find(r => r.highlight)?.name ?? parsed[0]?.name ?? "";
  } catch {
    return "";
  }
}
