import type { Lang } from "./lang";

const translations = {
  id: {
    // Hero
    hero_about: "Tentang Sekolah",
    hero_more: "Selengkapnya",
    hero_active_students: "Siswa Aktif",
    hero_founded: "Tahun Berdiri",
    hero_majors: "Konsentrasi Keahlian",
    hero_graduation: "Tingkat Kelulusan",
    hero_scroll: "Gulir ke bawah",

    // Stats
    stats_label: "Dalam Angka",
    stats_heading: "SMK Al-Munawwir IIBS dalam Angka",
    stats_sub: "Angka-angka ini mencerminkan kepercayaan masyarakat dan dedikasi kami dalam mendidik generasi terbaik.",
    stat_students: "Siswa Aktif",
    stat_students_desc: "Dari berbagai daerah di Indonesia",
    stat_majors: "Konsentrasi Keahlian",
    stat_majors_desc: "Sesuai kebutuhan industri",
    stat_achievements: "Prestasi Nasional",
    stat_achievements_desc: "Kompetisi & olimpiade",
    stat_graduation: "Tingkat Kelulusan",
    stat_graduation_desc: "Rata-rata 5 tahun terakhir",
    stat_years: "Tahun Berdiri",
    stat_years_desc: "Berdiri sejak",
    stat_partners: "Mitra Industri",
    stat_partners_desc: "Nasional & internasional",

    // Programs
    programs_label: "Program Kami",
    programs_heading: "5 Konsentrasi Keahlian Unggulan",
    programs_sub: "Pilih jurusan yang sesuai minat dan bakat — semua didukung instruktur berpengalaman dan fasilitas industri modern.",
    programs_view_all: "Lihat Semua Program",
    programs_explore: "Pelajari Program",
    islamic_program_title: "Program Islami Terintegrasi",
    islamic_program_desc: "Seluruh program keahlian dilengkapi dengan Tahfidz Al-Qur'an, Bahasa Arab intensif, kajian Islam, dan pembinaan akhlak dalam lingkungan pesantren modern.",

    // Programs data
    prog_tkj_desc: "Administrasi jaringan, keamanan siber, cloud computing, dan server management.",
    prog_ak_desc: "Pembukuan, perpajakan, laporan keuangan, dan manajemen keuangan bisnis.",
    prog_atu_desc: "Beternak unggas secara modern, manajemen farm, nutrisi ternak, dan agribisnis.",
    prog_dkv_desc: "Desain grafis, branding, fotografi, motion graphics, dan media digital kreatif.",
    prog_dpib_desc: "AutoCAD, SketchUp, BIM (Revit), estimasi bangunan, dan konstruksi digital.",

    // News
    news_label: "Terkini",
    news_heading: "Berita & Kegiatan",
    news_view_all: "Lihat Semua Berita",
    news_read_more: "Baca Selengkapnya",
    news_locale: "id-ID",

    // CTA
    cta_register: "Daftar Sekarang",
    cta_contact: "Hubungi Kami",
    cta_benefits: [
      "Asrama modern & nyaman",
      "Pengajar berpengalaman",
      "Sertifikasi nasional",
      "Hafalan Al-Qur'an terintegrasi",
      "Prakerin di perusahaan ternama",
      "Beasiswa bagi berprestasi",
    ],

    // Testimonials
    testimonials_label: "Testimoni",
    testimonials_heading: "Kata Mereka Tentang Kami",

    // Footer
    footer_school_desc: "SMK Al-Munawwir International Islamic Boarding School — Memadukan keunggulan akademik, keahlian vokasional, dan akhlak Islami untuk generasi terbaik.",
    footer_nav: "Navigasi",
    footer_majors: "Konsentrasi Keahlian",
    footer_contact: "Kontak",
    footer_hours_title: "Jam Operasional",
    footer_hours_closed: "Minggu: Tutup",
    footer_copyright: "Hak cipta dilindungi.",
    footer_links: [
      { name: "Tentang Kami", href: "/about" },
      { name: "Konsentrasi Keahlian", href: "/programs" },
      { name: "Fasilitas", href: "/facilities" },
      { name: "Ekstrakurikuler", href: "/extracurricular" },
      { name: "Pendaftaran (PPDB)", href: "/admissions" },
      { name: "Berita & Kegiatan", href: "/news" },
      { name: "Galeri", href: "/gallery" },
      { name: "Kontak", href: "/contact" },
    ],
    footer_programs: [
      "Teknik Komputer & Jaringan (TKJ)",
      "Akuntansi (AK)",
      "Agribisnis Ternak Unggas (ATU)",
      "Desain Komunikasi Visual (DKV)",
      "Desain Pemodelan & Informasi Bangunan (DPIB)",
    ],
  },

  en: {
    // Hero
    hero_about: "About School",
    hero_more: "Learn More",
    hero_active_students: "Active Students",
    hero_founded: "Year Founded",
    hero_majors: "Areas of Expertise",
    hero_graduation: "Graduation Rate",
    hero_scroll: "Scroll down",

    // Stats
    stats_label: "In Numbers",
    stats_heading: "SMK Al-Munawwir IIBS in Numbers",
    stats_sub: "These figures reflect the community's trust and our dedication to educating the best generation.",
    stat_students: "Active Students",
    stat_students_desc: "From various regions across Indonesia",
    stat_majors: "Areas of Expertise",
    stat_majors_desc: "Aligned with industry needs",
    stat_achievements: "National Achievements",
    stat_achievements_desc: "Competitions & olympiads",
    stat_graduation: "Graduation Rate",
    stat_graduation_desc: "Average over the last 5 years",
    stat_years: "Years Established",
    stat_years_desc: "Founded since",
    stat_partners: "Industry Partners",
    stat_partners_desc: "National & international",

    // Programs
    programs_label: "Our Programs",
    programs_heading: "5 Leading Areas of Expertise",
    programs_sub: "Choose a major that fits your interests and talents — all supported by experienced instructors and modern industry facilities.",
    programs_view_all: "View All Programs",
    programs_explore: "Explore Program",
    islamic_program_title: "Integrated Islamic Program",
    islamic_program_desc: "All skill programs are complemented by Qur'an memorization, intensive Arabic, Islamic studies, and character development in a modern Islamic boarding school environment.",

    // Programs data
    prog_tkj_desc: "Network administration, cybersecurity, cloud computing, and server management.",
    prog_ak_desc: "Bookkeeping, taxation, financial reporting, and business financial management.",
    prog_atu_desc: "Modern poultry farming, farm management, animal nutrition, and agribusiness.",
    prog_dkv_desc: "Graphic design, branding, photography, motion graphics, and creative digital media.",
    prog_dpib_desc: "AutoCAD, SketchUp, BIM (Revit), building estimation, and digital construction.",

    // News
    news_label: "Latest",
    news_heading: "News & Activities",
    news_view_all: "View All News",
    news_read_more: "Read More",
    news_locale: "en-US",

    // CTA
    cta_register: "Register Now",
    cta_contact: "Contact Us",
    cta_benefits: [
      "Modern & comfortable dormitory",
      "Experienced instructors",
      "National certification",
      "Integrated Qur'an memorization",
      "Internship at leading companies",
      "Scholarships for high achievers",
    ],

    // Testimonials
    testimonials_label: "Testimonials",
    testimonials_heading: "What They Say About Us",

    // Footer
    footer_school_desc: "SMK Al-Munawwir International Islamic Boarding School — Combining academic excellence, vocational skills, and Islamic character to nurture the best generation.",
    footer_nav: "Navigation",
    footer_majors: "Areas of Expertise",
    footer_contact: "Contact",
    footer_hours_title: "Operating Hours",
    footer_hours_closed: "Sunday: Closed",
    footer_copyright: "All rights reserved.",
    footer_links: [
      { name: "About Us", href: "/about" },
      { name: "Areas of Expertise", href: "/programs" },
      { name: "Facilities", href: "/facilities" },
      { name: "Extracurricular", href: "/extracurricular" },
      { name: "Admission (PPDB)", href: "/admissions" },
      { name: "News & Activities", href: "/news" },
      { name: "Gallery", href: "/gallery" },
      { name: "Contact", href: "/contact" },
    ],
    footer_programs: [
      "Computer & Network Engineering (TKJ)",
      "Accounting (AK)",
      "Poultry Agribusiness (ATU)",
      "Visual Communication Design (DKV)",
      "Building Modeling & Information Design (DPIB)",
    ],
  },
} as const;

export type T = typeof translations.id;
export function t(lang: Lang): T {
  return translations[lang] as T;
}
