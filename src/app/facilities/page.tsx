export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Image from "next/image";
import Link from "next/link";
import { Monitor, Home, BookOpen, Dumbbell, Wifi, Utensils, Building2, FlaskConical } from "lucide-react";
import { getLang } from "@/lib/lang";

export const metadata = {
  title: "Fasilitas — SMK Al Munawwir IIBS",
  description: "Fasilitas lengkap SMK Al Munawwir IIBS: laboratorium komputer, asrama modern, masjid, lapangan olahraga, dan lainnya.",
};

const content = {
  id: {
    heroLabel: "Lingkungan Belajar",
    heroTitle: "Fasilitas Kami",
    heroDesc: "Fasilitas lengkap dan modern untuk mendukung proses pembelajaran, pengembangan karakter, dan kehidupan santri di SMK Al Munawwir IIBS.",
    highlightsLabel: "Unggulan",
    highlightsTitle: "Fasilitas Pendukung Belajar",
    highlightsDesc: "Setiap fasilitas dirancang untuk mendukung keunggulan akademik, keahlian vokasional, dan pembentukan karakter Islami.",
    photoLabel: "Foto",
    photoTitle: "Galeri Fasilitas",
    ctaQuote: "\"Sesungguhnya bersama kesulitan ada kemudahan.\"",
    ctaTitle: "Ingin Melihat Langsung?",
    ctaDesc: "Kunjungi kampus kami dan rasakan langsung suasana boarding school islami yang modern dan kondusif.",
    ctaContact: "Hubungi Kami",
    ctaRegister: "Daftar Sekarang",
    highlights: [
      { icon: Monitor, title: "Laboratorium Komputer", desc: "6 ruang lab dengan 40 unit PC per lab, jaringan fiber optic, spesifikasi standar industri untuk TKJ & DKV.", color: "text-blue-600", bg: "bg-blue-50" },
      { icon: Home, title: "Asrama Modern", desc: "Asrama putra & putri terpisah, ber-AC, fasilitas lengkap, kapasitas 800 santri dengan pembinaan 24 jam.", color: "text-emerald-600", bg: "bg-emerald-50" },
      { icon: Building2, title: "Masjid Al Munawwir", desc: "Masjid kampus berkapasitas 1.500 jamaah untuk sholat berjamaah, tahfidz, dan kajian keislaman rutin.", color: "text-primary-700", bg: "bg-primary-50" },
      { icon: BookOpen, title: "Perpustakaan", desc: "Koleksi 5.000+ buku akademik & islami, area baca nyaman, akses e-library, dan pojok riset digital.", color: "text-amber-600", bg: "bg-amber-50" },
      { icon: FlaskConical, title: "Lab Agribisnis (ATU)", desc: "Kandang unggas modern, peralatan ternak berteknologi, dan lahan praktik pertanian terintegrasi.", color: "text-lime-700", bg: "bg-lime-50" },
      { icon: Dumbbell, title: "Lapangan Olahraga", desc: "Lapangan futsal, basket, badminton indoor, dan area jogging track di lingkungan kampus yang luas.", color: "text-red-600", bg: "bg-red-50" },
      { icon: Wifi, title: "Internet Kampus", desc: "Jaringan WiFi fiber optic berkecepatan tinggi di seluruh area — ruang kelas, asrama, perpustakaan, dan masjid.", color: "text-purple-600", bg: "bg-purple-50" },
      { icon: Utensils, title: "Dapur & Kantin", desc: "Dapur modern berstandar higienis, kantin dengan menu bergizi seimbang sesuai standar pesantren.", color: "text-orange-600", bg: "bg-orange-50" },
    ],
    stats: [
      { value: "6", label: "Laboratorium" },
      { value: "800+", label: "Kapasitas Asrama" },
      { value: "5.000+", label: "Koleksi Buku" },
      { value: "10 Ha", label: "Luas Kampus" },
    ],
  },
  en: {
    heroLabel: "Learning Environment",
    heroTitle: "Our Facilities",
    heroDesc: "Complete and modern facilities to support the learning process, character development, and student life at SMK Al Munawwir IIBS.",
    highlightsLabel: "Highlights",
    highlightsTitle: "Facilities That Support Learning",
    highlightsDesc: "Every facility is designed to support academic excellence, vocational skills, and the formation of Islamic character.",
    photoLabel: "Photos",
    photoTitle: "Facilities Gallery",
    ctaQuote: "\"Indeed, with hardship comes ease.\"",
    ctaTitle: "Want to See in Person?",
    ctaDesc: "Visit our campus and experience firsthand the modern and conducive atmosphere of an Islamic boarding school.",
    ctaContact: "Contact Us",
    ctaRegister: "Register Now",
    highlights: [
      { icon: Monitor, title: "Computer Labs", desc: "6 lab rooms with 40 PC units per lab, fiber-optic networking, industry-standard specifications for TKJ & DKV.", color: "text-blue-600", bg: "bg-blue-50" },
      { icon: Home, title: "Modern Dormitory", desc: "Separate boys' and girls' dormitories, air-conditioned, full facilities, capacity for 800 students with 24-hour supervision.", color: "text-emerald-600", bg: "bg-emerald-50" },
      { icon: Building2, title: "Al Munawwir Mosque", desc: "A campus mosque with capacity for 1,500 worshippers for congregational prayer, tahfidz, and regular Islamic studies.", color: "text-primary-700", bg: "bg-primary-50" },
      { icon: BookOpen, title: "Library", desc: "A collection of 5,000+ academic and Islamic books, a comfortable reading area, e-library access, and a digital research corner.", color: "text-amber-600", bg: "bg-amber-50" },
      { icon: FlaskConical, title: "Agribusiness Lab (ATU)", desc: "Modern poultry pens, technology-equipped livestock tools, and integrated agricultural practice land.", color: "text-lime-700", bg: "bg-lime-50" },
      { icon: Dumbbell, title: "Sports Fields", desc: "Futsal, basketball, and indoor badminton courts, plus a jogging track across the spacious campus grounds.", color: "text-red-600", bg: "bg-red-50" },
      { icon: Wifi, title: "Campus Internet", desc: "High-speed fiber-optic WiFi throughout the campus — classrooms, dormitories, library, and mosque.", color: "text-purple-600", bg: "bg-purple-50" },
      { icon: Utensils, title: "Kitchen & Canteen", desc: "A modern, hygienic kitchen and a canteen offering balanced, nutritious meals per pesantren standards.", color: "text-orange-600", bg: "bg-orange-50" },
    ],
    stats: [
      { value: "6", label: "Laboratories" },
      { value: "800+", label: "Dormitory Capacity" },
      { value: "5,000+", label: "Book Collection" },
      { value: "10 Ha", label: "Campus Area" },
    ],
  },
} as const;

export default async function FacilitiesPage() {
  const lang = await getLang();
  const c = content[lang];
  let photos: Awaited<ReturnType<typeof prisma.gallery.findMany>> = [];
  try {
    photos = await prisma.gallery.findMany({
      where: { category: "Fasilitas" },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    });
  } catch { /* DB unavailable */ }

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

        {/* Highlights Grid */}
        <section className="py-16 bg-white">
          <div className="container-custom">
            <div className="text-center mb-12">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.highlightsLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2 mb-3">{c.highlightsTitle}</h2>
              <p className="text-gray-500 max-w-xl mx-auto text-sm">
                {c.highlightsDesc}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {c.highlights.map(({ icon: Icon, title, desc, color, bg }) => (
                <div key={title} className="p-6 rounded-2xl border border-gray-100 hover:shadow-md transition-shadow group">
                  <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center mb-4 group-hover:scale-105 transition-transform`}>
                    <Icon size={22} className={color} />
                  </div>
                  <h3 className="font-heading font-bold text-navy text-base mb-2">{title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Photo Gallery */}
        {photos.length > 0 && (
          <section className="py-16 bg-cream">
            <div className="container-custom">
              <div className="text-center mb-10">
                <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.photoLabel}</span>
                <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.photoTitle}</h2>
              </div>
              <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
                {photos.map((photo) => (
                  <div key={photo.id} className="break-inside-avoid">
                    <div className="relative rounded-2xl overflow-hidden bg-gray-100 group">
                      <Image
                        src={photo.imageUrl}
                        alt={photo.title}
                        width={600}
                        height={400}
                        className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                        unoptimized
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <p className="text-white text-sm font-semibold">{photo.title}</p>
                        {photo.caption && <p className="text-white/70 text-xs mt-0.5">{photo.caption}</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Stats Banner */}
        <section className="py-12 bg-white border-y border-gray-100">
          <div className="container-custom">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {c.stats.map(({ value, label }) => (
                <div key={label}>
                  <p className="font-heading font-bold text-3xl text-primary-700 mb-1">{value}</p>
                  <p className="text-gray-500 text-sm">{label}</p>
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
            <p className="font-arabic text-gold text-2xl mb-4">فَإِنَّ مَعَ الْعُسْرِ يُسْرًا</p>
            <h2 className="font-heading text-3xl font-bold mb-3">{c.ctaTitle}</h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              {c.ctaDesc}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/contact"
                className="px-8 py-3 rounded-full bg-gold hover:bg-gold/90 text-primary-900 font-bold transition">
                {c.ctaContact}
              </Link>
              <Link href="/admissions"
                className="px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white/10 transition font-semibold">
                {c.ctaRegister}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
