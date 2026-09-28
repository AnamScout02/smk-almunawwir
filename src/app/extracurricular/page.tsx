import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Users, Music, Globe, BookOpen, Cpu, Trophy, Heart, Sprout, Shield } from "lucide-react";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Ekstrakurikuler — SMK Al Munawwir IIBS",
  description: "Berbagai kegiatan ekstrakurikuler di SMK Al Munawwir IIBS — dari olahraga, seni, akademik, hingga keislaman.",
};

const content = {
  id: {
    heroLabel: "Kehidupan Kampus",
    heroTitle: "Ekstrakurikuler",
    heroDesc: "Lebih dari sekedar belajar di kelas — SMK Al Munawwir IIBS menyediakan berbagai kegiatan ekstrakurikuler untuk mengembangkan bakat, minat, dan karakter santri secara menyeluruh.",
    quote: "\"Siapa yang bersungguh-sungguh, ia akan berhasil.\"",
    categoriesLabel: "Pilihan",
    categoriesTitle: "Kategori Ekskul",
    categoriesDesc: "Setiap siswa didorong untuk aktif dalam minimal satu ekskul sebagai bagian dari pengembangan diri di lingkungan pesantren.",
    achievementsLabel: "Prestasi",
    achievementsTitle: "Jejak Prestasi Ekskul",
    joinLabel: "Bergabung",
    joinTitle: "Cara Bergabung Ekskul",
    ctaTitle: "Siap Bergabung?",
    ctaDesc: "Daftarkan diri sebagai siswa SMK Al Munawwir IIBS dan jadilah bagian dari komunitas belajar islami yang dinamis dan berprestasi.",
    ctaRegister: "Daftar Sekarang",
    ctaAsk: "Tanya Lebih Lanjut",
    categories: [
      {
        title: "Organisasi", icon: Shield, color: "text-primary-700", bg: "bg-primary-50", border: "border-primary-100",
        items: [
          { name: "OSIS", desc: "Organisasi Intra Sekolah — pusat kepemimpinan dan kreativitas siswa." },
          { name: "Pramuka", desc: "Pengembangan karakter, disiplin, dan jiwa kepemimpinan melalui kegiatan kepramukaan." },
          { name: "PMR (Palang Merah Remaja)", desc: "Pelatihan pertolongan pertama, donor darah, dan kegiatan sosial kemanusiaan." },
        ],
      },
      {
        title: "Keislaman", icon: BookOpen, color: "text-gold", bg: "bg-amber-50", border: "border-amber-100",
        items: [
          { name: "Tahfidz Club", desc: "Program intensif hafalan Al-Qur'an dengan bimbingan ustadz/ustadzah berpengalaman." },
          { name: "Kajian Islam", desc: "Forum kajian rutin membahas ilmu agama, fiqih muamalah, dan akhlak." },
          { name: "Da'wah & Khatib", desc: "Latihan pidato, khotbah Jumat, dan syiar Islam untuk santri berbakat." },
        ],
      },
      {
        title: "Olahraga", icon: Trophy, color: "text-red-600", bg: "bg-red-50", border: "border-red-100",
        items: [
          { name: "Futsal", desc: "Tim futsal kampus yang aktif mengikuti kompetisi antar sekolah dan santri." },
          { name: "Badminton", desc: "Latihan rutin di lapangan indoor kampus dengan pelatih berpengalaman." },
          { name: "Basket", desc: "Tim basket yang berkompetisi di turnamen lokal dan regional." },
          { name: "Pencak Silat", desc: "Seni bela diri khas Nusantara sebagai pembentukan fisik dan mental." },
        ],
      },
      {
        title: "Seni & Budaya", icon: Music, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100",
        items: [
          { name: "Qasidah / Hadrah", desc: "Seni musik islami dengan rebana dan sholawat Nabi yang dilestarikan di pesantren." },
          { name: "Kaligrafi", desc: "Seni menulis Arab (kaligrafi) dari khat Naskhi hingga Tsuluts dan Diwani." },
          { name: "Teater & Drama", desc: "Pengembangan seni peran, panggung, dan ekspresi diri santri." },
        ],
      },
      {
        title: "Teknologi & Akademik", icon: Cpu, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
        items: [
          { name: "Robotika / IT Club", desc: "Eksplorasi pemrograman, Arduino, dan proyek teknologi inovatif." },
          { name: "English Club", desc: "Komunitas berbahasa Inggris — debat, speaking, storytelling, dan conversation practice." },
          { name: "Mading & Jurnalistik", desc: "Majalah dinding digital dan pelatihan menulis serta liputan jurnalistik sekolah." },
        ],
      },
      {
        title: "Kewirausahaan", icon: Sprout, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
        items: [
          { name: "Young Entrepreneur Club", desc: "Pelatihan bisnis, marketing digital, dan inkubasi usaha kecil untuk santri." },
          { name: "Koperasi Santri", desc: "Pengelolaan koperasi sekolah sebagai laboratorium wirausaha nyata." },
        ],
      },
    ],
    joinSteps: [
      { step: "01", title: "Daftar Sebagai Siswa", desc: "Selesaikan proses SPMB dan diterima sebagai siswa aktif SMK Al Munawwir IIBS." },
      { step: "02", title: "Pilih Ekskul", desc: "Di awal tahun ajaran, pilih satu atau lebih ekskul yang sesuai minat dan bakat kamu." },
      { step: "03", title: "Latihan Rutin", desc: "Ikuti latihan dan kegiatan rutin ekskul yang dijadwalkan oleh pembina." },
    ],
  },
  en: {
    heroLabel: "Campus Life",
    heroTitle: "Extracurricular Activities",
    heroDesc: "More than just classroom learning — SMK Al Munawwir IIBS offers a wide range of extracurricular activities to fully develop students' talents, interests, and character.",
    quote: "\"Whoever strives earnestly will succeed.\"",
    categoriesLabel: "Choices",
    categoriesTitle: "Extracurricular Categories",
    categoriesDesc: "Every student is encouraged to be active in at least one extracurricular activity as part of personal development within the boarding school environment.",
    achievementsLabel: "Achievements",
    achievementsTitle: "Extracurricular Achievement Highlights",
    joinLabel: "Joining",
    joinTitle: "How to Join an Extracurricular",
    ctaTitle: "Ready to Join?",
    ctaDesc: "Register as a student at SMK Al Munawwir IIBS and become part of a dynamic, high-achieving Islamic learning community.",
    ctaRegister: "Register Now",
    ctaAsk: "Ask More",
    categories: [
      {
        title: "Organizations", icon: Shield, color: "text-primary-700", bg: "bg-primary-50", border: "border-primary-100",
        items: [
          { name: "OSIS (Student Council)", desc: "The school's intra-organization — a hub for student leadership and creativity." },
          { name: "Scouts", desc: "Building character, discipline, and leadership spirit through scouting activities." },
          { name: "PMR (Youth Red Cross)", desc: "First-aid training, blood donation drives, and humanitarian social activities." },
        ],
      },
      {
        title: "Islamic Studies", icon: BookOpen, color: "text-gold", bg: "bg-amber-50", border: "border-amber-100",
        items: [
          { name: "Tahfidz Club", desc: "An intensive Qur'an memorization program guided by experienced ustadz/ustadzah." },
          { name: "Islamic Studies Forum", desc: "A regular study forum covering religious knowledge, fiqh muamalah, and character." },
          { name: "Da'wah & Preaching", desc: "Public speaking and Friday sermon practice, and Islamic outreach for talented students." },
        ],
      },
      {
        title: "Sports", icon: Trophy, color: "text-red-600", bg: "bg-red-50", border: "border-red-100",
        items: [
          { name: "Futsal", desc: "The campus futsal team actively competes in inter-school and pesantren competitions." },
          { name: "Badminton", desc: "Regular practice at the campus indoor court with an experienced coach." },
          { name: "Basketball", desc: "A basketball team that competes in local and regional tournaments." },
          { name: "Pencak Silat", desc: "A traditional Nusantara martial art for physical and mental development." },
        ],
      },
      {
        title: "Arts & Culture", icon: Music, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-100",
        items: [
          { name: "Qasidah / Hadrah", desc: "Islamic music art with rebana drums and Prophetic praise songs preserved in the pesantren." },
          { name: "Calligraphy", desc: "Arabic calligraphy from Naskhi script to Tsuluts and Diwani styles." },
          { name: "Theater & Drama", desc: "Developing students' acting, stage presence, and self-expression." },
        ],
      },
      {
        title: "Technology & Academics", icon: Cpu, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-100",
        items: [
          { name: "Robotics / IT Club", desc: "Exploring programming, Arduino, and innovative technology projects." },
          { name: "English Club", desc: "An English-speaking community — debate, speaking, storytelling, and conversation practice." },
          { name: "Wall Magazine & Journalism", desc: "A digital wall magazine and training in writing and school journalism coverage." },
        ],
      },
      {
        title: "Entrepreneurship", icon: Sprout, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-100",
        items: [
          { name: "Young Entrepreneur Club", desc: "Business training, digital marketing, and small business incubation for students." },
          { name: "Student Cooperative", desc: "Managing the school cooperative as a real-world entrepreneurship laboratory." },
        ],
      },
    ],
    joinSteps: [
      { step: "01", title: "Register as a Student", desc: "Complete the SPMB process and be accepted as an active student at SMK Al Munawwir IIBS." },
      { step: "02", title: "Choose an Activity", desc: "At the start of the school year, choose one or more activities that match your interests and talents." },
      { step: "03", title: "Regular Practice", desc: "Join the regular practice and activities scheduled by the supervisor." },
    ],
  },
} as const;

interface AchievementRow { event: string; scope: string; year: string }

export default async function ExtracurricularPage() {
  const lang = await getLang();
  const c = content[lang];
  const s = await getSettings(["ekskul.achievements"]);
  let achievements: AchievementRow[] = [];
  try {
    const parsed = JSON.parse(s["ekskul.achievements"] || "[]");
    if (Array.isArray(parsed)) achievements = parsed;
  } catch { /* ignore */ }
  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.heroLabel}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">{c.heroTitle}</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              {c.heroDesc}
            </p>
          </div>
        </section>

        {/* Islamic Quote */}
        <section className="py-10 bg-white border-b border-gray-100">
          <div className="container-custom text-center">
            <p className="font-arabic text-primary-700 text-3xl mb-2">مَنْ جَدَّ وَجَدَ</p>
            <p className="text-gray-500 text-sm italic">{c.quote}</p>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16 bg-cream">
          <div className="container-custom">
            <div className="text-center mb-12">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.categoriesLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-3">{c.categoriesTitle}</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-sm">
                {c.categoriesDesc}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {c.categories.map(({ title, icon: Icon, color, bg, border, items }) => (
                <div key={title} className={`bg-white rounded-2xl border ${border} shadow-sm overflow-hidden`}>
                  <div className={`px-6 py-4 flex items-center gap-3 ${bg} border-b ${border}`}>
                    <div className={`w-9 h-9 rounded-xl bg-white flex items-center justify-center shadow-sm`}>
                      <Icon size={18} className={color} />
                    </div>
                    <h3 className="font-heading font-bold text-navy">{title}</h3>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {items.map(({ name, desc }) => (
                      <div key={name} className="px-6 py-4 hover:bg-gray-50 transition">
                        <p className="font-semibold text-sm text-primary-900 mb-0.5">{name}</p>
                        <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Achievements */}
        <section className="py-16 bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.achievementsLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.achievementsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
              {achievements.map(({ event, scope, year }) => (
                <div key={event} className="flex items-start gap-4 p-5 rounded-2xl bg-gradient-to-br from-primary-50 to-white border border-primary-100">
                  <div className="w-10 h-10 rounded-xl bg-gold/20 flex items-center justify-center shrink-0">
                    <Trophy size={18} className="text-gold" />
                  </div>
                  <div>
                    <p className="font-semibold text-primary-900 text-sm leading-snug">{event}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{scope}</p>
                    <p className="text-primary-700 text-xs font-semibold mt-1">{year}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How to Join */}
        <section className="py-16 bg-cream">
          <div className="container-custom">
            <div className="max-w-3xl mx-auto text-center mb-10">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.joinLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-3">{c.joinTitle}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {c.joinSteps.map(({ step, title, desc }) => (
                <div key={step} className="text-center">
                  <div className="w-14 h-14 rounded-full bg-primary-900 text-gold font-heading font-bold text-xl flex items-center justify-center mx-auto mb-4">
                    {step}
                  </div>
                  <h4 className="font-heading font-bold text-navy mb-2">{title}</h4>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-primary-900 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom relative">
            <div className="flex justify-center mb-6">
              <div className="flex -space-x-2">
                {[Heart, Trophy, Globe, Music, Users].map((Icon, i) => (
                  <div key={i} className="w-10 h-10 rounded-full bg-white/10 border-2 border-primary-900 flex items-center justify-center">
                    <Icon size={14} className="text-gold" />
                  </div>
                ))}
              </div>
            </div>
            <h2 className="font-heading text-3xl font-bold mb-3">{c.ctaTitle}</h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              {c.ctaDesc}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/admissions"
                className="px-8 py-3 rounded-full bg-gold hover:bg-gold/90 text-primary-900 font-bold transition">
                {c.ctaRegister}
              </Link>
              <Link href="/contact"
                className="px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white/10 transition font-semibold">
                {c.ctaAsk}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
