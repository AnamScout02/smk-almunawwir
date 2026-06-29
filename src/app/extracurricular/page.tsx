import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { Users, Music, Globe, BookOpen, Cpu, Trophy, Heart, Sprout, Shield } from "lucide-react";

export const metadata = {
  title: "Ekstrakurikuler — SMK Al-Munawwir IIBS",
  description: "Berbagai kegiatan ekstrakurikuler di SMK Al-Munawwir IIBS — dari olahraga, seni, akademik, hingga keislaman.",
};

const categories = [
  {
    title: "Organisasi",
    icon: Shield,
    color: "text-primary-700",
    bg: "bg-primary-50",
    border: "border-primary-100",
    items: [
      { name: "OSIS", desc: "Organisasi Intra Sekolah — pusat kepemimpinan dan kreativitas siswa." },
      { name: "Pramuka", desc: "Pengembangan karakter, disiplin, dan jiwa kepemimpinan melalui kegiatan kepramukaan." },
      { name: "PMR (Palang Merah Remaja)", desc: "Pelatihan pertolongan pertama, donor darah, dan kegiatan sosial kemanusiaan." },
    ],
  },
  {
    title: "Keislaman",
    icon: BookOpen,
    color: "text-gold",
    bg: "bg-amber-50",
    border: "border-amber-100",
    items: [
      { name: "Tahfidz Club", desc: "Program intensif hafalan Al-Qur'an dengan bimbingan ustadz/ustadzah berpengalaman." },
      { name: "Kajian Islam", desc: "Forum kajian rutin membahas ilmu agama, fiqih muamalah, dan akhlak." },
      { name: "Da'wah & Khatib", desc: "Latihan pidato, khotbah Jumat, dan syiar Islam untuk santri berbakat." },
    ],
  },
  {
    title: "Olahraga",
    icon: Trophy,
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
    items: [
      { name: "Futsal", desc: "Tim futsal kampus yang aktif mengikuti kompetisi antar sekolah dan santri." },
      { name: "Badminton", desc: "Latihan rutin di lapangan indoor kampus dengan pelatih berpengalaman." },
      { name: "Basket", desc: "Tim basket yang berkompetisi di turnamen lokal dan regional." },
      { name: "Pencak Silat", desc: "Seni bela diri khas Nusantara sebagai pembentukan fisik dan mental." },
    ],
  },
  {
    title: "Seni & Budaya",
    icon: Music,
    color: "text-purple-600",
    bg: "bg-purple-50",
    border: "border-purple-100",
    items: [
      { name: "Qasidah / Hadrah", desc: "Seni musik islami dengan rebana dan sholawat Nabi yang dilestarikan di pesantren." },
      { name: "Kaligrafi", desc: "Seni menulis Arab (kaligrafi) dari khat Naskhi hingga Tsuluts dan Diwani." },
      { name: "Teater & Drama", desc: "Pengembangan seni peran, panggung, dan ekspresi diri santri." },
    ],
  },
  {
    title: "Teknologi & Akademik",
    icon: Cpu,
    color: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-100",
    items: [
      { name: "Robotika / IT Club", desc: "Eksplorasi pemrograman, Arduino, dan proyek teknologi inovatif." },
      { name: "English Club", desc: "Komunitas berbahasa Inggris — debat, speaking, storytelling, dan conversation practice." },
      { name: "Mading & Jurnalistik", desc: "Majalah dinding digital dan pelatihan menulis serta liputan jurnalistik sekolah." },
    ],
  },
  {
    title: "Kewirausahaan",
    icon: Sprout,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
    items: [
      { name: "Young Entrepreneur Club", desc: "Pelatihan bisnis, marketing digital, dan inkubasi usaha kecil untuk santri." },
      { name: "Koperasi Santri", desc: "Pengelolaan koperasi sekolah sebagai laboratorium wirausaha nyata." },
    ],
  },
];

const achievements = [
  { event: "Juara 1 LKS TKJ", scope: "Tingkat Kabupaten", year: "2024" },
  { event: "Juara 2 Kaligrafi", scope: "Tingkat Provinsi", year: "2024" },
  { event: "Juara 1 Futsal", scope: "Turnamen Pesantren Se-Jatim", year: "2023" },
  { event: "Best Speaker English Debate", scope: "Tingkat Kabupaten", year: "2023" },
  { event: "Juara 3 Tahfidz 10 Juz", scope: "MTQ Pelajar Provinsi", year: "2024" },
  { event: "Juara 1 LKS DKV", scope: "Tingkat Kabupaten", year: "2023" },
];

export default function ExtracurricularPage() {
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
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">Kehidupan Kampus</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">Ekstrakurikuler</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              Lebih dari sekedar belajar di kelas — SMK Al-Munawwir IIBS menyediakan berbagai kegiatan
              ekstrakurikuler untuk mengembangkan bakat, minat, dan karakter santri secara menyeluruh.
            </p>
          </div>
        </section>

        {/* Islamic Quote */}
        <section className="py-10 bg-white border-b border-gray-100">
          <div className="container-custom text-center">
            <p className="font-arabic text-primary-700 text-3xl mb-2">مَنْ جَدَّ وَجَدَ</p>
            <p className="text-gray-500 text-sm italic">"Siapa yang bersungguh-sungguh, ia akan berhasil."</p>
          </div>
        </section>

        {/* Categories */}
        <section className="py-16 bg-cream">
          <div className="container-custom">
            <div className="text-center mb-12">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">Pilihan</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-3">Kategori Ekskul</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-sm">
                Setiap siswa didorong untuk aktif dalam minimal satu ekskul sebagai bagian dari pengembangan diri di lingkungan pesantren.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {categories.map(({ title, icon: Icon, color, bg, border, items }) => (
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
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">Prestasi</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">Jejak Prestasi Ekskul</h2>
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
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">Bergabung</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-3">Cara Bergabung Ekskul</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
              {[
                { step: "01", title: "Daftar Sebagai Siswa", desc: "Selesaikan proses PPDB dan diterima sebagai siswa aktif SMK Al-Munawwir IIBS." },
                { step: "02", title: "Pilih Ekskul", desc: "Di awal tahun ajaran, pilih satu atau lebih ekskul yang sesuai minat dan bakat kamu." },
                { step: "03", title: "Latihan Rutin", desc: "Ikuti latihan dan kegiatan rutin ekskul yang dijadwalkan oleh pembina." },
              ].map(({ step, title, desc }) => (
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
                  <div key={i} className="w-10 h-10 rounded-full bg-white/10 border-2 border-primary-800 flex items-center justify-center">
                    <Icon size={14} className="text-gold" />
                  </div>
                ))}
              </div>
            </div>
            <h2 className="font-heading text-3xl font-bold mb-3">Siap Bergabung?</h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              Daftarkan diri sebagai siswa SMK Al-Munawwir IIBS dan jadilah bagian dari komunitas belajar islami yang dinamis dan berprestasi.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/admissions"
                className="px-8 py-3 rounded-full bg-gold hover:bg-gold/90 text-primary-900 font-bold transition">
                Daftar Sekarang
              </Link>
              <Link href="/contact"
                className="px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white/10 transition font-semibold">
                Tanya Lebih Lanjut
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
