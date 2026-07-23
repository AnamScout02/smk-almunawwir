import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import IslamicQuote from "@/components/shared/IslamicQuote";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import {
  Eye, Target, Users, BookOpen, MapPin,
  GraduationCap, Briefcase, Lightbulb, Globe, BookMarked, Trophy,
  School, Landmark, Mail, Phone, CreditCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tentang Kami — SMK Al Munawwir IIBS",
  description: "Mengenal lebih dekat SMK Al Munawwir IIBS Banyuwangi — sejarah, visi, misi, dan keunggulan kami.",
};

interface StructureRow { role: string; name: string; highlight?: boolean }
interface KaprodiRow { code: string; name: string }

const content = {
  id: {
    identitas: [
      { label: "Nama Sekolah", value: "SMK Al Munawwir IIBS", settingKey: undefined, icon: School },
      { label: "NPSN", value: "69896523", settingKey: undefined, icon: CreditCard },
      { label: "NIB", value: "2707230280495", settingKey: undefined, icon: CreditCard },
      { label: "Nama Yayasan", value: "Yayasan Islam Al Munawwir Makshum", settingKey: undefined, icon: Landmark },
      { label: "Alamat", value: "", settingKey: "contact.address" as const, icon: MapPin },
      { label: "Telepon / WA", value: "", settingKey: "contact.phone" as const, icon: Phone },
      { label: "Email", value: "", settingKey: "contact.email" as const, icon: Mail },
    ],
    misi: [
      "Mengembangkan kurikulum yang berkualitas dengan memadukan kurikulum internasional, nasional, dan lokal.",
      "Menerapkan kurikulum berbasis industri serta meningkatkan kompetensi peserta didik sesuai dengan kebutuhan dunia kerja.",
      "Menerapkan penggunaan bahasa asing dalam proses pembelajaran maupun pengelolaan sekolah.",
      "Menanamkan dan mengamalkan nilai-nilai karakter Islami serta membentuk jiwa kepemimpinan pada seluruh warga sekolah.",
      "Mendorong penguasaan ilmu pengetahuan, teknologi, serta memperluas wawasan global guna menghadapi tantangan perkembangan zaman.",
    ],
    fokus: [
      { icon: GraduationCap, title: "Kampus Favorit", desc: "Mempersiapkan peserta didik agar mampu melanjutkan pendidikan ke perguruan tinggi unggulan dalam maupun luar negeri melalui penguatan akademik dan bimbingan karier." },
      { icon: Trophy, title: "Leadership", desc: "Membentuk karakter kepemimpinan, tanggung jawab, dan kedisiplinan melalui kegiatan organisasi siswa, pelatihan kepemimpinan, dan pembiasaan budaya positif." },
      { icon: Lightbulb, title: "Entrepreneur", desc: "Menumbuhkan jiwa kewirausahaan, kreativitas, dan kemandirian melalui Teaching Factory, Projek Kreatif & Kewirausahaan, serta kegiatan produktif berbasis kompetensi." },
      { icon: Briefcase, title: "Professional Worker", desc: "Menghasilkan lulusan berkompetensi sesuai kebutuhan DUDIKA — dibekali etos kerja, disiplin, integritas, dan daya saing tinggi di tingkat nasional maupun internasional." },
      { icon: BookMarked, title: "Kurikulum Diniyyah", desc: "Menanamkan nilai keimanan, ketakwaan, dan akhlakul karimah melalui pembelajaran kitab, tahfidz Al-Qur'an, pembiasaan ibadah, dan budaya religius pesantren." },
      { icon: Globe, title: "Kurikulum Internasional", desc: "Meningkatkan kemampuan bahasa asing dan wawasan global, membangun budaya belajar adaptif untuk bersaing di era globalisasi dan revolusi industri." },
    ],
    bidang: [
      { code: "TKJ", name: "Teknik Komputer & Jaringan", bidang: "Teknologi Informasi & Komunikasi" },
      { code: "AK", name: "Akuntansi", bidang: "Bisnis & Manajemen" },
      { code: "ATU", name: "Agribisnis Ternak Unggas", bidang: "Agribisnis & Agroteknologi" },
      { code: "DKV", name: "Desain Komunikasi Visual", bidang: "Seni & Industri Kreatif" },
      { code: "DPIB", name: "Desain Pemodelan & Informasi Bangunan", bidang: "Teknologi Konstruksi" },
    ],
    sejarah: [
      { year: "2014", title: "Berdiri sebagai SMK NU Manbaul Falah", desc: "Sekolah didirikan di bawah naungan Yayasan Pondok Pesantren Manbaul Falah. Dua program keahlian dibuka sejak awal: Teknik Komputer & Jaringan (TKJ) dan Akuntansi (AK). TKJ langsung menerima peserta didik sejak tahun pertama berdiri." },
      { year: "2018", title: "AK Mulai Menerima Siswa", desc: "Memasuki tahun kelima, Konsentrasi Keahlian Akuntansi (AK) resmi mulai menerima peserta didik baru, sehingga kedua program keahlian yang telah terdaftar kini beroperasi penuh." },
      { year: "2020", title: "Ekspansi: DKV & ATU Dibuka", desc: "Memasuki tahun ketujuh, sekolah membuka dua konsentrasi keahlian baru — Desain Komunikasi Visual (DKV) dan Agribisnis Ternak Unggas (ATU) — untuk memperluas pilihan pendidikan vokasional bagi peserta didik." },
      { year: "2023", title: "Transformasi: Menjadi SMK Al Munawwir IIBS", desc: "Sekolah berganti nama menjadi SMK Al Munawwir International Islamic Boarding School (IIBS) di bawah yayasan baru yang dibentuk secara mandiri, yaitu Yayasan Islam Al Munawwir Makshum. Di tahun yang sama, Konsentrasi Keahlian Desain Pemodelan & Informasi Bangunan (DPIB) resmi dibuka sebagai program kelima." },
    ],
    heroLabel: "Tentang Kami",
    heroTitlePrefix: "Mengenal SMK Al",
    heroTitleSuffix: "Munawwir IIBS",
    heroDesc: "Satuan pendidikan menengah kejuruan di bawah naungan Yayasan Islam Al Munawwir Makshum Banyuwangi — berkomitmen menghasilkan lulusan yang berkarakter Islami, kompeten secara profesional, berjiwa kepemimpinan, dan berwawasan global.",
    profilLabel: "Identitas",
    profilTitle: "Profil Sekolah",
    profilDesc: "SMK Al Munawwir International Islamic Boarding School (IIBS) adalah sekolah berbasis pesantren dengan orientasi internasional yang memadukan kurikulum nasional, kurikulum internasional, dan nilai-nilai keislaman. Pengelolaan dilaksanakan secara profesional oleh tenaga pendidik dan kependidikan yang berkompeten di bidangnya.",
    bidangCaption: "Bidang Keahlian Resmi",
    sejarahLabel: "Perjalanan",
    sejarahTitle: "Sejarah Sekolah",
    visiMisiLabel: "Visi",
    visiTitle: "Visi",
    visiText: "“Menjadikan sekolah berbasis internasional serta mewujudkan sumber daya manusia yang bertakwa, berkarakter, berkepemimpinan, kompeten, dan berwawasan global.”",
    misiTitle: "Misi",
    tujuanTitle: "Tujuan Sekolah",
    tujuanText: "Menghasilkan lulusan yang memiliki keimanan dan ketakwaan kepada Allah SWT, berakhlakul karimah, berjiwa kepemimpinan, kompeten sesuai bidang keahlian, serta mampu bersaing pada tingkat nasional maupun internasional — didukung tata kelola pendidikan yang profesional dan budaya mutu yang berkelanjutan.",
    fokusLabel: "Keunggulan",
    fokusTitle: "Enam Fokus Strategis Pengembangan",
    fokusDesc: "Arah kebijakan yang menjadi landasan seluruh program pendidikan dan pengelolaan sekolah.",
    strukturLabel: "Organisasi",
    strukturTitle: "Struktur Pimpinan",
    strukturYearPrefix: "Tahun Ajaran",
    kaprodiTitle: "Kepala Kompetensi Keahlian",
  },
  en: {
    identitas: [
      { label: "School Name", value: "SMK Al Munawwir IIBS", settingKey: undefined, icon: School },
      { label: "NPSN", value: "69896523", settingKey: undefined, icon: CreditCard },
      { label: "NIB", value: "2707230280495", settingKey: undefined, icon: CreditCard },
      { label: "Foundation Name", value: "Yayasan Islam Al Munawwir Makshum", settingKey: undefined, icon: Landmark },
      { label: "Address", value: "", settingKey: "contact.address" as const, icon: MapPin },
      { label: "Phone / WA", value: "", settingKey: "contact.phone" as const, icon: Phone },
      { label: "Email", value: "", settingKey: "contact.email" as const, icon: Mail },
    ],
    misi: [
      "Developing a high-quality curriculum that blends international, national, and local curricula.",
      "Applying an industry-based curriculum and improving student competency to match workforce needs.",
      "Applying the use of foreign languages in both the learning process and school management.",
      "Instilling and practicing Islamic character values while shaping leadership spirit across the whole school community.",
      "Encouraging mastery of science and technology, and broadening global outlook to face the challenges of the times.",
    ],
    fokus: [
      { icon: GraduationCap, title: "Favorite Campus", desc: "Preparing students to continue their education at leading universities at home and abroad through academic strengthening and career guidance." },
      { icon: Trophy, title: "Leadership", desc: "Building leadership character, responsibility, and discipline through student organizations, leadership training, and positive culture habits." },
      { icon: Lightbulb, title: "Entrepreneur", desc: "Cultivating an entrepreneurial spirit, creativity, and independence through Teaching Factory, Creative & Entrepreneurship Projects, and competency-based productive activities." },
      { icon: Briefcase, title: "Professional Worker", desc: "Producing graduates competent to meet industry (DUDIKA) needs — equipped with work ethic, discipline, integrity, and strong national and international competitiveness." },
      { icon: BookMarked, title: "Diniyyah Curriculum", desc: "Instilling faith, piety, and noble character through classical text studies, Qur'an memorization, worship habituation, and the religious culture of a boarding school." },
      { icon: Globe, title: "International Curriculum", desc: "Improving foreign language ability and global outlook, building an adaptive learning culture to compete in the era of globalization and industrial revolution." },
    ],
    bidang: [
      { code: "TKJ", name: "Computer & Network Engineering", bidang: "Information & Communication Technology" },
      { code: "AK", name: "Accounting", bidang: "Business & Management" },
      { code: "ATU", name: "Poultry Agribusiness", bidang: "Agribusiness & Agrotechnology" },
      { code: "DKV", name: "Visual Communication Design", bidang: "Arts & Creative Industry" },
      { code: "DPIB", name: "Building Modeling & Information Design", bidang: "Construction Technology" },
    ],
    sejarah: [
      { year: "2014", title: "Founded as SMK NU Manbaul Falah", desc: "The school was established under the Manbaul Falah Islamic Boarding School Foundation. Two skill programs opened from the start: Computer & Network Engineering (TKJ) and Accounting (AK). TKJ enrolled students from its very first year." },
      { year: "2018", title: "AK Begins Enrolling Students", desc: "Entering its fifth year, the Accounting (AK) program officially began accepting new students, bringing both registered programs to full operation." },
      { year: "2020", title: "Expansion: DKV & ATU Open", desc: "Entering its seventh year, the school opened two new skill programs — Visual Communication Design (DKV) and Poultry Agribusiness (ATU) — to broaden vocational education options for students." },
      { year: "2023", title: "Transformation: Becomes SMK Al Munawwir IIBS", desc: "The school was renamed SMK Al Munawwir International Islamic Boarding School (IIBS) under a newly, independently formed foundation, Yayasan Islam Al Munawwir Makshum. In the same year, the Building Modeling & Information Design (DPIB) program officially opened as the fifth program." },
    ],
    heroLabel: "About Us",
    heroTitlePrefix: "Get to Know SMK Al",
    heroTitleSuffix: "Munawwir IIBS",
    heroDesc: "A vocational secondary education institution under the Yayasan Islam Al Munawwir Makshum Banyuwangi — committed to producing graduates with Islamic character, professional competence, leadership spirit, and a global outlook.",
    profilLabel: "Identity",
    profilTitle: "School Profile",
    profilDesc: "SMK Al Munawwir International Islamic Boarding School (IIBS) is a pesantren-based school with an international orientation that blends the national curriculum, international curriculum, and Islamic values. It is managed professionally by educators and staff competent in their fields.",
    bidangCaption: "Official Skill Programs",
    sejarahLabel: "Our Journey",
    sejarahTitle: "School History",
    visiMisiLabel: "Vision",
    visiTitle: "Vision",
    visiText: "“To become an internationally based school and to build human resources who are devout, of strong character, capable leaders, competent, and globally minded.”",
    misiTitle: "Mission",
    tujuanTitle: "School Goals",
    tujuanText: "To produce graduates with faith and devotion to Allah SWT, noble character, leadership spirit, and competency in their field of expertise, able to compete at both national and international levels — supported by professional educational governance and a sustainable culture of quality.",
    fokusLabel: "Strengths",
    fokusTitle: "Six Strategic Development Focuses",
    fokusDesc: "The policy direction that underpins all educational programs and school management.",
    strukturLabel: "Organization",
    strukturTitle: "Leadership Structure",
    strukturYearPrefix: "Academic Year",
    kaprodiTitle: "Head of Skill Competency",
  },
} as const;

export default async function AboutPage() {
  const lang = await getLang();
  const c = content[lang];
  const settings = await getSettings(["school.structure", "school.kaprodi", "school.struktur_year", "contact.address", "contact.phone", "contact.email"]);
  const strukturYear = lang === "en"
    ? `${settings["school.struktur_year"]} ${c.strukturYearPrefix}`
    : `${c.strukturYearPrefix} ${settings["school.struktur_year"]}`;
  let structure: StructureRow[] = [];
  try {
    const parsed = JSON.parse(settings["school.structure"] ?? "[]");
    if (Array.isArray(parsed)) structure = parsed;
  } catch {
    structure = [];
  }
  let kaprodi: KaprodiRow[] = [];
  try {
    const parsed = JSON.parse(settings["school.kaprodi"] ?? "[]");
    if (Array.isArray(parsed)) kaprodi = parsed;
  } catch {
    kaprodi = [];
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.heroLabel}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">
              {c.heroTitlePrefix} <span className="whitespace-nowrap">{c.heroTitleSuffix}</span>
            </h1>
            <p className="text-white/80 text-lg leading-relaxed max-w-3xl mx-auto">
              {c.heroDesc}
            </p>
          </div>
        </section>

        {/* Profil & Identitas */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="grid md:grid-cols-2 gap-12 items-start">
              <div>
                <span className="text-gold font-semibold text-sm uppercase tracking-widest">{c.profilLabel}</span>
                <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-6">{c.profilTitle}</h2>
                <p className="text-gray-600 text-sm leading-relaxed mb-6">
                  {c.profilDesc}
                </p>
                <div className="space-y-3">
                  {c.identitas.map((item) => {
                    const Icon = item.icon;
                    const value = item.settingKey ? settings[item.settingKey] : item.value;
                    return (
                      <div key={item.label} className="flex gap-3 p-3.5 rounded-xl bg-gray-50">
                        <div className="w-9 h-9 bg-primary-50 rounded-lg flex items-center justify-center shrink-0">
                          <Icon size={15} className="text-primary-700" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 font-medium">{item.label}</p>
                          <p className="text-navy font-semibold text-sm">{value}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-primary-50 rounded-3xl p-8">
                <p className="font-arabic text-primary-700 text-2xl mb-4 text-center">المنور</p>
                <p className="text-center text-gray-500 text-sm mb-6">{c.bidangCaption}</p>
                <div className="space-y-3">
                  {c.bidang.map((p) => (
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
              <span className="text-gold font-semibold text-sm uppercase tracking-widest">{c.sejarahLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.sejarahTitle}</h2>
            </div>
            <div className="max-w-3xl mx-auto">
              <div className="relative border-l-2 border-primary-100 pl-8 space-y-10">
                {c.sejarah.map((item, i) => (
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
              <div className="relative rounded-3xl p-8 text-white overflow-hidden bg-primary-700">
                <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
                  style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "120px 120px", backgroundRepeat: "repeat", filter: "invert(1)" }}
                />
                <div className="relative">
                  <div className="flex items-center gap-3 mb-4">
                    <Eye size={28} className="text-gold" />
                    <h2 className="font-heading text-2xl font-bold">{c.visiTitle}</h2>
                  </div>
                  <p className="text-white/90 text-lg leading-relaxed italic">
                    {c.visiText}
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-gray-100">
                <div className="flex items-center gap-3 mb-4">
                  <Target size={28} className="text-primary-700" />
                  <h2 className="font-heading text-2xl font-bold text-navy">{c.misiTitle}</h2>
                </div>
                <ul className="space-y-3">
                  {c.misi.map((m, i) => (
                    <li key={i} className="flex gap-3 text-gray-600 text-sm">
                      <div className="w-5 h-5 rounded-full bg-gold/20 text-gold flex items-center justify-center text-xs shrink-0 mt-0.5 font-bold">{i + 1}</div>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Tujuan */}
            <div className="relative rounded-3xl p-8 text-white text-center max-w-3xl mx-auto overflow-hidden bg-primary-900">
              <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
                style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "120px 120px", backgroundRepeat: "repeat", filter: "invert(1)" }}
              />
              <div className="relative">
                <BookOpen size={32} className="text-gold mx-auto mb-4" />
                <h3 className="font-heading text-xl font-bold mb-3">{c.tujuanTitle}</h3>
                <p className="text-white/80 leading-relaxed text-sm">
                  {c.tujuanText}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6 Fokus Strategis */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <span className="text-gold font-semibold text-sm uppercase tracking-widest">{c.fokusLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">
                {c.fokusTitle}
              </h2>
              <p className="text-gray-500 text-sm mt-2 max-w-xl mx-auto">
                {c.fokusDesc}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {c.fokus.map(({ icon: Icon, title, desc }) => (
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
              <span className="text-gold font-semibold text-sm uppercase tracking-widest">{c.strukturLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.strukturTitle}</h2>
              <p className="text-gray-400 text-sm mt-1">{strukturYear}</p>
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
              <h3 className="font-heading font-bold text-navy text-base mb-3 px-1">{c.kaprodiTitle}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {kaprodi.map((k) => (
                  <div key={k.code} className="flex items-center gap-3 p-3.5 bg-white rounded-xl border border-gray-100">
                    <span className="text-xs font-bold bg-primary-700 text-white px-2 py-0.5 rounded-md shrink-0">{k.code}</span>
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
