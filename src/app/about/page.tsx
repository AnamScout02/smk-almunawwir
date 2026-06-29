import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import IslamicQuote from "@/components/shared/IslamicQuote";
import {
  Eye, Target, Users, BookOpen, MapPin,
  GraduationCap, Briefcase, Lightbulb, Globe, BookMarked, Trophy,
  School, Landmark, Mail, Phone, CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Tentang Kami — SMK Al-Munawwir IIBS",
  description: "Mengenal lebih dekat SMK Al-Munawwir IIBS Banyuwangi — sejarah, visi, misi, dan keunggulan kami.",
};

const identitas: { label: string; value: string; icon: LucideIcon }[] = [
  { label: "Nama Sekolah", value: "SMK Al-Munawwir IIBS", icon: School },
  { label: "NPSN", value: "69896523", icon: CreditCard },
  { label: "NIB", value: "2707230280495", icon: CreditCard },
  { label: "Nama Yayasan", value: "Yayasan Islam Al-Munawwir Makshum", icon: Landmark },
  { label: "Alamat", value: "Jl. Kedungliwung No. 36, Ds. Kemiri, Kec. Singojuruh, Banyuwangi, Jawa Timur", icon: MapPin },
  { label: "Telepon / WA", value: "0838-7820-3670", icon: Phone },
  { label: "Email", value: "smkalmunawwir@gmail.com", icon: Mail },
];

const misi = [
  "Mengembangkan kurikulum yang berkualitas dengan memadukan kurikulum internasional, nasional, dan lokal.",
  "Menerapkan kurikulum berbasis industri serta meningkatkan kompetensi peserta didik sesuai dengan kebutuhan dunia kerja.",
  "Menerapkan penggunaan bahasa asing dalam proses pembelajaran maupun pengelolaan sekolah.",
  "Menanamkan dan mengamalkan nilai-nilai karakter Islami serta membentuk jiwa kepemimpinan pada seluruh warga sekolah.",
  "Mendorong penguasaan ilmu pengetahuan, teknologi, serta memperluas wawasan global guna menghadapi tantangan perkembangan zaman.",
];

const fokus = [
  {
    icon: GraduationCap,
    title: "Kampus Favorit",
    desc: "Mempersiapkan peserta didik agar mampu melanjutkan pendidikan ke perguruan tinggi unggulan dalam maupun luar negeri melalui penguatan akademik dan bimbingan karier.",
  },
  {
    icon: Trophy,
    title: "Leadership",
    desc: "Membentuk karakter kepemimpinan, tanggung jawab, dan kedisiplinan melalui kegiatan organisasi siswa, pelatihan kepemimpinan, dan pembiasaan budaya positif.",
  },
  {
    icon: Lightbulb,
    title: "Entrepreneur",
    desc: "Menumbuhkan jiwa kewirausahaan, kreativitas, dan kemandirian melalui Teaching Factory, Projek Kreatif & Kewirausahaan, serta kegiatan produktif berbasis kompetensi.",
  },
  {
    icon: Briefcase,
    title: "Professional Worker",
    desc: "Menghasilkan lulusan berkompetensi sesuai kebutuhan DUDIKA — dibekali etos kerja, disiplin, integritas, dan daya saing tinggi di tingkat nasional maupun internasional.",
  },
  {
    icon: BookMarked,
    title: "Kurikulum Diniyyah",
    desc: "Menanamkan nilai keimanan, ketakwaan, dan akhlakul karimah melalui pembelajaran kitab, tahfidz Al-Qur'an, pembiasaan ibadah, dan budaya religius pesantren.",
  },
  {
    icon: Globe,
    title: "Kurikulum Internasional",
    desc: "Meningkatkan kemampuan bahasa asing dan wawasan global, membangun budaya belajar adaptif untuk bersaing di era globalisasi dan revolusi industri.",
  },
];

const structure = [
  { role: "Kepala Sekolah", name: "Ahmad Azmi Khoirul Umam, S.Pt, M.Pt, M.Sc", highlight: true },
  { role: "Waka Bid. Kurikulum", name: "Soleh Afandi, S.Pd" },
  { role: "Waka Bid. Kesiswaan", name: "Miftahul Huda, S.Pd" },
  { role: "Waka Bid. Humas", name: "Eko Supriyono, S.Sos" },
  { role: "Waka Bid. Sarpras", name: "Bagus Ramadhan, S.Tr.Pt" },
  { role: "Waka Bid. Penjamin Mutu", name: "Mohammad Sholeh Mubarok, S.Pd., S.S.Ag" },
];

const kaprodi = [
  { kode: "TKJ", name: "Rita Defiana, S.Pd" },
  { kode: "AK", name: "Nur Hidayah, SE" },
  { kode: "DKV", name: "Anggun Ahmad Shodikin, S.Sos" },
  { kode: "ATU", name: "Wahyu Fitri Yani, S.Tr.Pt" },
  { kode: "DPIB", name: "Virga Ahmad Fauzi, S.T" },
];

export default function AboutPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white section-padding">
          <div className="container-custom max-w-3xl">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">Tentang Kami</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">
              Mengenal SMK Al-Munawwir IIBS
            </h1>
            <p className="text-white/80 text-lg leading-relaxed">
              Satuan pendidikan menengah kejuruan di bawah naungan Yayasan Islam Al-Munawwir Makshum Banyuwangi —
              berkomitmen menghasilkan lulusan yang berkarakter Islami, kompeten secara profesional,
              berjiwa kepemimpinan, dan berwawasan global.
            </p>
          </div>
        </section>

        {/* Profil & Identitas */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <span className="text-gold font-semibold text-sm uppercase tracking-widest">Identitas</span>
                <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-6">Profil Sekolah</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  SMK Al-Munawwir International Islamic Boarding School (IIBS) adalah sekolah berbasis
                  pesantren dengan orientasi internasional yang memadukan kurikulum nasional, kurikulum
                  internasional, dan nilai-nilai keislaman. Pengelolaan dilaksanakan secara profesional
                  oleh tenaga pendidik dan kependidikan yang berkompeten di bidangnya.
                </p>
                <div className="space-y-3">
                  {identitas.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.label} className="flex gap-3 p-3.5 rounded-xl bg-gray-50">
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                          <Icon size={15} className="text-primary-700" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                          <p className="text-navy font-semibold text-sm">{item.value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-primary-50 rounded-3xl p-8">
                <p className="font-arabic text-primary-700 text-2xl mb-4 text-center">المنور</p>
                <p className="text-center text-gray-500 text-sm mb-6">Bidang Keahlian Resmi</p>
                <div className="space-y-3">
                  {[
                    { code: "TKJ", name: "Teknik Komputer & Jaringan", bidang: "Teknologi Informasi & Komunikasi" },
                    { code: "AK", name: "Akuntansi", bidang: "Bisnis & Manajemen" },
                    { code: "ATU", name: "Agribisnis Ternak Unggas", bidang: "Agribisnis & Agroteknologi" },
                    { code: "DKV", name: "Desain Komunikasi Visual", bidang: "Seni & Industri Kreatif" },
                    { code: "DPIB", name: "Desain Pemodelan & Informasi Bangunan", bidang: "Teknologi Konstruksi" },
                  ].map((p) => (
                    <div key={p.code} className="bg-white rounded-xl p-3.5 flex items-center gap-3">
                      <span className="text-xs font-bold bg-primary-700 text-white px-2 py-0.5 rounded-md shrink-0">{p.code}</span>
                      <div>
                        <p className="font-semibold text-navy text-sm">{p.name}</p>
                        <p className="text-gray-400 text-xs">{p.bidang}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Sejarah */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <span className="text-gold font-semibold text-sm uppercase tracking-widest">Perjalanan</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">Sejarah Sekolah</h2>
            </div>
            <div className="max-w-3xl mx-auto">
              <div className="relative border-l-2 border-primary-100 pl-8 space-y-10">
                {[
                  {
                    year: "2014",
                    title: "Berdiri sebagai SMK NU Manbaul Falah",
                    desc: "Sekolah didirikan di bawah naungan Yayasan Pondok Pesantren Manbaul Falah. Dua program keahlian dibuka sejak awal: Teknik Komputer & Jaringan (TKJ) dan Akuntansi (AK). TKJ langsung menerima peserta didik sejak tahun pertama berdiri.",
                  },
                  {
                    year: "2018",
                    title: "AK Mulai Menerima Siswa",
                    desc: "Memasuki tahun kelima, Konsentrasi Keahlian Akuntansi (AK) resmi mulai menerima peserta didik baru, sehingga kedua program keahlian yang telah terdaftar kini beroperasi penuh.",
                  },
                  {
                    year: "2020",
                    title: "Ekspansi: DKV & ATU Dibuka",
                    desc: "Memasuki tahun ketujuh, sekolah membuka dua konsentrasi keahlian baru — Desain Komunikasi Visual (DKV) dan Agribisnis Ternak Unggas (ATU) — untuk memperluas pilihan pendidikan vokasional bagi peserta didik.",
                  },
                  {
                    year: "2023",
                    title: "Transformasi: Menjadi SMK Al-Munawwir IIBS",
                    desc: "Sekolah berganti nama menjadi SMK Al-Munawwir International Islamic Boarding School (IIBS) di bawah yayasan baru yang dibentuk secara mandiri, yaitu Yayasan Islam Al-Munawwir Makshum. Di tahun yang sama, Konsentrasi Keahlian Desain Pemodelan & Informasi Bangunan (DPIB) resmi dibuka sebagai program kelima.",
                  },
                ].map((item, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-11 w-6 h-6 rounded-full bg-primary-700 border-4 border-white flex items-center justify-center shadow-sm" />
                    <div className="bg-cream rounded-2xl p-5">
                      <span className="inline-block text-xs font-bold text-gold bg-primary-900 px-3 py-1 rounded-full mb-2">{item.year}</span>
                      <h3 className="font-heading font-bold text-navy mb-2">{item.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Visi & Misi */}
        <section className="section-padding bg-cream">
          <div className="container-custom">
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-primary-700 rounded-3xl p-8 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <Eye size={28} className="text-gold" />
                  <h2 className="font-heading text-2xl font-bold">Visi</h2>
                </div>
                <p className="text-white/90 text-lg leading-relaxed italic">
                  "Menjadikan sekolah berbasis internasional serta mewujudkan sumber daya manusia
                  yang bertakwa, berkarakter, berkepemimpinan, kompeten, dan berwawasan global."
                </p>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <Target size={28} className="text-primary-700" />
                  <h2 className="font-heading text-2xl font-bold text-navy">Misi</h2>
                </div>
                <ul className="space-y-3">
                  {misi.map((m, i) => (
                    <li key={i} className="flex gap-3 text-gray-600 text-sm">
                      <div className="w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">{i + 1}</div>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Tujuan */}
            <div className="bg-primary-900 rounded-3xl p-8 text-white text-center max-w-3xl mx-auto">
              <BookOpen size={32} className="text-gold mx-auto mb-4" />
              <h3 className="font-heading text-xl font-bold mb-3">Tujuan Sekolah</h3>
              <p className="text-white/80 leading-relaxed text-sm">
                Menghasilkan lulusan yang memiliki keimanan dan ketakwaan kepada Allah SWT, berakhlakul karimah,
                berjiwa kepemimpinan, kompeten sesuai bidang keahlian, serta mampu bersaing pada tingkat
                nasional maupun internasional — didukung tata kelola pendidikan yang profesional dan
                budaya mutu yang berkelanjutan.
              </p>
            </div>
          </div>
        </section>

        {/* 6 Fokus Strategis */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <span className="text-gold font-semibold text-sm uppercase tracking-widest">Keunggulan</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">
                Enam Fokus Strategis Pengembangan
              </h2>
              <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">
                Arah kebijakan yang menjadi landasan seluruh program pendidikan dan pengelolaan sekolah.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {fokus.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="bg-cream rounded-2xl p-6 border border-gray-100 hover:border-gold/30 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 flex items-center justify-center mb-4">
                    <Icon size={22} className="text-primary-700" />
                  </div>
                  <h3 className="font-heading font-bold text-navy mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Struktur Organisasi */}
        <section className="section-padding bg-cream">
          <div className="container-custom max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <span className="text-gold font-semibold text-sm uppercase tracking-widest">Organisasi</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">Struktur Pimpinan</h2>
              <p className="text-gray-400 text-sm mt-1">Tahun Ajaran 2025–2026</p>
            </div>

            {/* Kepala & Wakil */}
            <div className="space-y-2.5 mb-8">
              {structure.map((s) => (
                <div key={s.role} className={`flex items-center justify-between p-4 rounded-xl border ${
                  s.highlight
                    ? "bg-primary-700 border-primary-600 text-white"
                    : "bg-white border-gray-100"
                }`}>
                  <span className={`text-sm font-medium ${s.highlight ? "text-white/80" : "text-gray-500"}`}>
                    {s.role}
                  </span>
                  <span className={`font-semibold text-sm text-right ${s.highlight ? "text-gold" : "text-navy"}`}>
                    {s.name}
                  </span>
                </div>
              ))}
            </div>

            {/* Kepala Kompetensi Keahlian */}
            <div>
              <h3 className="font-heading font-bold text-navy text-base mb-3 px-1">Kepala Kompetensi Keahlian</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {kaprodi.map((k) => (
                  <div key={k.kode} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-100">
                    <span className="text-xs font-bold bg-primary-700 text-white px-2 py-0.5 rounded-md shrink-0">{k.kode}</span>
                    <span className="text-navy font-semibold text-sm">{k.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12 bg-white">
          <div className="container-custom max-w-xl mx-auto">
            <IslamicQuote index={0} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
