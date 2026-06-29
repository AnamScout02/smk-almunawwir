import { prisma } from "./prisma";

export const DEFAULTS: Record<string, string> = {
  // Ayat & Hadis
  "islamic.cta_arabic": "وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا",
  "islamic.cta_trans": "Dan barangsiapa bertakwa kepada Allah, niscaya Dia akan membukakan jalan keluar baginya.",
  "islamic.cta_source": "QS. Ath-Thalaq: 2",
  "islamic.footer_arabic": "النور يهدي إلى النور",
  "islamic.login_arabic": "اقْرَأْ بِاسْمِ رَبِّكَ",
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
  "logo.full_white": "",
  // Statistik
  "stats.students": "1200",
  "stats.achievements": "50",
  "stats.graduation_rate": "98",
  "stats.years": "12",
  "stats.partners": "30",
  "stats.founded_year": "2014",
  // Banner CTA
  "cta.title": "Bergabunglah Bersama Kami",
  "cta.ppdb_year": "2026/2027",
  "cta.subtitle": "PPDB 2026/2027 kini dibuka. Jadikan anak Anda bagian dari generasi Qurani yang terampil dan berdaya saing global.",
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
