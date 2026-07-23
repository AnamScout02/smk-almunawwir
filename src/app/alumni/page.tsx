import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { GraduationCap, Briefcase, MapPin, Quote } from "lucide-react";
import { getLang } from "@/lib/lang";

export const metadata = {
  title: "Alumni — SMK Al Munawwir IIBS",
  description: "Kisah sukses alumni SMK Al Munawwir IIBS yang telah berkarir dan melanjutkan pendidikan di berbagai bidang.",
};

const content = {
  id: {
    heroLabel: "Kebanggaan Kami",
    heroTitle: "Alumni Berprestasi",
    heroDesc: "Kisah nyata lulusan SMK Al Munawwir IIBS yang telah berhasil berkarir, berwirausaha, dan melanjutkan pendidikan — membawa bekal ilmu dan akhlak Islami.",
    testimonialsLabel: "Kata Mereka",
    testimonialsTitle: "Cerita Sukses Alumni",
    destinationsLabel: "Setelah Lulus",
    destinationsTitle: "Kemana Alumni Kami Pergi",
    ctaAlumniTitle: "Kamu Alumni Al Munawwir?",
    ctaAlumniDesc: "Bagikan kisah suksesmu dan jadilah inspirasi bagi adik-adik kelas. Hubungi kami untuk bergabung di komunitas alumni.",
    ctaAlumniBtn: "Hubungi Kami",
    ctaRegTitle: "Jadilah Bagian dari Cerita Ini",
    ctaRegDesc: "Daftar sekarang dan mulai perjalananmu menuju masa depan yang cerah bersama SMK Al Munawwir IIBS.",
    ctaRegBtn: "Daftar Sekarang",
    ctaProgramsBtn: "Lihat Program Studi",
    stats: [
      { value: "92%", label: "Terserap Kerja / Kuliah", sub: "Dalam 6 bulan setelah lulus" },
      { value: "500+", label: "Alumni Aktif", sub: "Tersebar di seluruh Indonesia" },
      { value: "3", label: "Angkatan Lulusan", sub: "2021, 2022, 2023" },
      { value: "15+", label: "Perusahaan Mitra", sub: "Tempat alumni bekerja" },
    ],
    testimonials: [
      { name: "Ahmad Fauzan Hidayat", year: "Lulus 2022", major: "TKJ", role: "Network Engineer", company: "PT. Telkom Indonesia", city: "Surabaya", quote: "SMK Al Munawwir tidak hanya mengajarkan skill teknis, tapi juga membentuk karakter dan akhlak yang menjadi bekal seumur hidup saya.", initial: "AF", color: "bg-blue-500" },
      { name: "Siti Rahma Aulia", year: "Lulus 2021", major: "AK", role: "Staff Akuntansi", company: "Bank Syariah Indonesia", city: "Jakarta", quote: "Pengalaman tahfidz dan pesantren di sini membuat saya lebih disiplin dan fokus. Sertifikasi akuntansi yang saya dapat sangat membantu karir.", initial: "SR", color: "bg-emerald-500" },
      { name: "Rizky Maulana Putra", year: "Lulus 2023", major: "DKV", role: "Graphic Designer", company: "Freelance & Startup", city: "Yogyakarta", quote: "Lab DKV di Al Munawwir sudah setara industri. Saya bisa langsung kerja profesional setelah lulus tanpa perlu kursus tambahan.", initial: "RM", color: "bg-purple-500" },
      { name: "Dewi Nur Halimah", year: "Lulus 2022", major: "ATU", role: "Pemilik Farm Unggas", company: "CV. Berkah Ternak Mandiri", city: "Malang", quote: "Bekal ilmu agribisnis dan semangat wirausaha yang ditanamkan di sekolah ini mendorong saya membuka usaha sendiri setelah lulus.", initial: "DN", color: "bg-lime-600" },
      { name: "Muhammad Ilham Saputra", year: "Lulus 2021", major: "DPIB", role: "Drafter / Junior Arsitek", company: "Konsultan Arsitektur Nusantara", city: "Bandung", quote: "Kemampuan AutoCAD dan BIM yang saya kuasai dari sekolah ini langsung diakui oleh perusahaan. Hafalan Quran yang saya bawa jadi kebanggaan tersendiri.", initial: "MI", color: "bg-amber-500" },
      { name: "Nur Fitriani Rahmawati", year: "Lulus 2023", major: "TKJ", role: "Mahasiswi Teknik Informatika", company: "Universitas Airlangga", city: "Surabaya", quote: "Fondasi TKJ dari Al Munawwir sangat kuat. Saya lulus SNBP ke UNAIR berkat nilai dan portofolio yang sudah saya bangun sejak SMK.", initial: "NF", color: "bg-rose-500" },
    ],
    destinations: [
      { category: "Bekerja", icon: "💼", places: ["PT. Telkom Indonesia", "Bank Syariah Indonesia", "Perusahaan Manufaktur", "UMKM & Wirausaha Mandiri", "Startup Digital"] },
      { category: "Melanjutkan Kuliah", icon: "🎓", places: ["Universitas Airlangga", "UPN Veteran Jawa Timur", "Politeknik Elektronika Negeri Surabaya", "Universitas Islam Negeri Sunan Ampel", "Politeknik Negeri Malang"] },
      { category: "Program Vokasi", icon: "🏫", places: ["Diploma 3 Akuntansi", "Diploma 3 Teknik Komputer", "Diploma 3 Desain Grafis", "Sekolah Kedinasan", "PPKD & Kemnaker"] },
    ],
  },
  en: {
    heroLabel: "Our Pride",
    heroTitle: "Accomplished Alumni",
    heroDesc: "Real stories of SMK Al Munawwir IIBS graduates who have built careers, started businesses, and continued their education — carrying with them knowledge and Islamic character.",
    testimonialsLabel: "What They Say",
    testimonialsTitle: "Alumni Success Stories",
    destinationsLabel: "After Graduation",
    destinationsTitle: "Where Our Alumni Go",
    ctaAlumniTitle: "Are You an Al Munawwir Alumnus?",
    ctaAlumniDesc: "Share your success story and inspire our younger students. Contact us to join the alumni community.",
    ctaAlumniBtn: "Contact Us",
    ctaRegTitle: "Be Part of This Story",
    ctaRegDesc: "Register now and start your journey toward a bright future with SMK Al Munawwir IIBS.",
    ctaRegBtn: "Register Now",
    ctaProgramsBtn: "View Study Programs",
    stats: [
      { value: "92%", label: "Employed / Enrolled in College", sub: "Within 6 months of graduating" },
      { value: "500+", label: "Active Alumni", sub: "Spread across Indonesia" },
      { value: "3", label: "Graduating Classes", sub: "2021, 2022, 2023" },
      { value: "15+", label: "Partner Companies", sub: "Where alumni work" },
    ],
    testimonials: [
      { name: "Ahmad Fauzan Hidayat", year: "Class of 2022", major: "TKJ", role: "Network Engineer", company: "PT. Telkom Indonesia", city: "Surabaya", quote: "SMK Al Munawwir didn't just teach me technical skills, but also shaped the character and akhlaq that became a lifelong foundation for me.", initial: "AF", color: "bg-blue-500" },
      { name: "Siti Rahma Aulia", year: "Class of 2021", major: "AK", role: "Accounting Staff", company: "Bank Syariah Indonesia", city: "Jakarta", quote: "The tahfidz and boarding school experience here made me more disciplined and focused. The accounting certification I earned has really helped my career.", initial: "SR", color: "bg-emerald-500" },
      { name: "Rizky Maulana Putra", year: "Class of 2023", major: "DKV", role: "Graphic Designer", company: "Freelance & Startup", city: "Yogyakarta", quote: "The DKV lab at Al Munawwir is industry-grade. I could work professionally right after graduating without needing extra courses.", initial: "RM", color: "bg-purple-500" },
      { name: "Dewi Nur Halimah", year: "Class of 2022", major: "ATU", role: "Poultry Farm Owner", company: "CV. Berkah Ternak Mandiri", city: "Malang", quote: "The agribusiness knowledge and entrepreneurial spirit instilled at this school pushed me to open my own business after graduating.", initial: "DN", color: "bg-lime-600" },
      { name: "Muhammad Ilham Saputra", year: "Class of 2021", major: "DPIB", role: "Drafter / Junior Architect", company: "Konsultan Arsitektur Nusantara", city: "Bandung", quote: "The AutoCAD and BIM skills I mastered at this school were immediately recognized by the company. The Qur'an memorization I carry with me is a special source of pride.", initial: "MI", color: "bg-amber-500" },
      { name: "Nur Fitriani Rahmawati", year: "Class of 2023", major: "TKJ", role: "Information Technology Student", company: "Universitas Airlangga", city: "Surabaya", quote: "The TKJ foundation from Al Munawwir is very strong. I got into UNAIR through SNBP thanks to the grades and portfolio I built since vocational school.", initial: "NF", color: "bg-rose-500" },
    ],
    destinations: [
      { category: "Employed", icon: "💼", places: ["PT. Telkom Indonesia", "Bank Syariah Indonesia", "Manufacturing Companies", "SMEs & Independent Entrepreneurship", "Digital Startups"] },
      { category: "Continuing to College", icon: "🎓", places: ["Universitas Airlangga", "UPN Veteran Jawa Timur", "Politeknik Elektronika Negeri Surabaya", "Universitas Islam Negeri Sunan Ampel", "Politeknik Negeri Malang"] },
      { category: "Vocational Programs", icon: "🏫", places: ["Diploma 3 Accounting", "Diploma 3 Computer Engineering", "Diploma 3 Graphic Design", "Civil Service Schools", "PPKD & Ministry of Manpower"] },
    ],
  },
} as const;

export default async function AlumniPage() {
  const lang = await getLang();
  const c = content[lang];
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
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">{c.heroTitle}</h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              {c.heroDesc}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="py-12 bg-white border-b border-gray-100">
          <div className="container-custom">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {c.stats.map(({ value, label, sub }) => (
                <div key={label}>
                  <p className="font-heading font-bold text-3xl text-primary-700 mb-1">{value}</p>
                  <p className="font-semibold text-sm text-navy">{label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16 bg-cream">
          <div className="container-custom">
            <div className="text-center mb-12">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.testimonialsLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.testimonialsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {c.testimonials.map((alum) => (
                <div key={alum.name} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                  <Quote size={24} className="text-gold/40 mb-3" />
                  <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6 italic">
                    &ldquo;{alum.quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <div className={`w-10 h-10 rounded-full ${alum.color} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                      {alum.initial}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-navy truncate">{alum.name}</p>
                      <p className="text-xs text-gray-400 truncate">{alum.role} · {alum.company}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold">{alum.major}</span>
                        <span className="text-xs text-gray-400">{alum.year}</span>
                        <span className="flex items-center gap-0.5 text-xs text-gray-400">
                          <MapPin size={10} />{alum.city}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Destinations */}
        <section className="py-16 bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.destinationsLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.destinationsTitle}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {c.destinations.map(({ category, icon, places }) => (
                <div key={category} className="bg-gray-50 rounded-2xl p-6">
                  <div className="text-3xl mb-3">{icon}</div>
                  <h3 className="font-heading font-bold text-navy text-lg mb-4 flex items-center gap-2">
                    {(category === "Bekerja" || category === "Employed") && <Briefcase size={16} className="text-primary-700" />}
                    {(category === "Melanjutkan Kuliah" || category === "Continuing to College") && <GraduationCap size={16} className="text-primary-700" />}
                    {category}
                  </h3>
                  <ul className="space-y-2">
                    {places.map(p => (
                      <li key={p} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-gold mt-0.5">·</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA for Alumni */}
        <section className="py-12 bg-primary-50 border-y border-primary-100">
          <div className="container-custom text-center">
            <h3 className="font-heading font-bold text-2xl text-navy mb-3">{c.ctaAlumniTitle}</h3>
            <p className="text-gray-500 mb-6 max-w-lg mx-auto text-sm">
              {c.ctaAlumniDesc}
            </p>
            <Link href="/contact"
              className="inline-flex px-8 py-3 rounded-full bg-primary-700 hover:bg-primary-800 text-white font-semibold transition">
              {c.ctaAlumniBtn}
            </Link>
          </div>
        </section>

        {/* CTA Register */}
        <section className="py-16 bg-primary-900 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom relative">
            <GraduationCap size={48} className="text-gold mx-auto mb-4" />
            <h2 className="font-heading text-3xl font-bold mb-3">{c.ctaRegTitle}</h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              {c.ctaRegDesc}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/admissions"
                className="px-8 py-3 rounded-full bg-gold hover:bg-gold/90 text-primary-900 font-bold transition">
                {c.ctaRegBtn}
              </Link>
              <Link href="/programs"
                className="px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white/10 transition font-semibold">
                {c.ctaProgramsBtn}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
