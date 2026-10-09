export const dynamic = "force-dynamic";

import { logoMitraPublik } from "@/lib/logo-mitra";
import StatistikPkl from "@/components/sections/StatistikPkl";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Hero from "@/components/sections/Hero";
import Stats from "@/components/sections/Stats";
import Programs from "@/components/sections/Programs";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import NewsPreview from "@/components/sections/NewsPreview";
import Testimonials from "@/components/sections/Testimonials";
import CTABanner from "@/components/sections/CTABanner";
import PrayerTimes from "@/components/shared/PrayerTimes";
import IslamicQuote from "@/components/shared/IslamicQuote";
import StoryGaleri from "@/components/gerak/StoryGaleri";
import PitaKata from "@/components/gerak/PitaKata";
import DeretLogo from "@/components/gerak/DeretLogo";
import { bacaKontenSpmb } from "@/lib/spmb-konten";
import { bacaTestimoni } from "@/lib/testimoni";
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export default async function HomePage() {
  const lang = await getLang();
  const [s, studentCount, majorCount] = await Promise.all([
    getSettings(["stats.founded_year", "stats.graduation_rate", "school.tagline", "school.hero_subtitle",
      "beranda.kataBerjalan", "beranda.testimoni", "spmb.fotoPromosi", "spmb.judulGaleri", "spmb.galeriLain", "spmb.logoMitra", "spmb.judulLogo",
      "contact.phone", "contact.email", "contact.address", "logo.emblem", "school.name"]),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
    prisma.major.count().catch(() => 0),
  ]);
  // Story & deret logo memakai bahan yang SUDAH diunggah panitia di Pusat SPMB → Poster & Promosi.
  const k = bacaKontenSpmb(s);
  const logoMitra = await logoMitraPublik(k.logoMitra);
  const story = [
    ...(k.fotoPromosi.length ? [{ judul: k.judulGaleri || (lang === "id" ? "Galeri" : "Gallery"), foto: k.fotoPromosi }] : []),
    ...k.galeriLain.map(g => ({ judul: g.judul || (lang === "id" ? "Galeri" : "Gallery"), foto: g.foto })),
  ];
  // Kosong = pita disembunyikan (Konten Halaman → Keunggulan).
  const kata = (s["beranda.kataBerjalan"] ?? "").trim();
  const testimoni = bacaTestimoni(s["beranda.testimoni"]);
  // Data terstruktur sekolah (schema.org, 7 Okt 2026) — dibaca Google untuk panel info sekolah di hasil pencarian.
  // Isinya dari pengaturan Kontak & logo yang sama dengan Footer, jadi tidak ada data kedua yang bisa berbeda.
  const logo = s["logo.emblem"] ? (s["logo.emblem"].startsWith("http") ? s["logo.emblem"] : `${ALAMAT_APLIKASI}${s["logo.emblem"]}`) : `${ALAMAT_APLIKASI}/images/logo-emblem.png`;
  const dataSekolah = {
    "@context": "https://schema.org",
    "@type": "HighSchool",
    name: s["school.name"] || "SMK Al Munawwir IIBS",
    alternateName: ["SMK Al-Munawwir International Islamic Boarding School", "SMK Al Munawwir Singojuruh", "SMK Alwis"],
    url: ALAMAT_APLIKASI,
    logo,
    image: logo,
    description: "SMK berbasis pesantren di Singojuruh, Banyuwangi — Mendidik Generasi Qurani Terampil Berwawasan Global. NPSN 69896523.",
    telephone: s["contact.phone"] || undefined,
    email: s["contact.email"] || undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: s["contact.address"] || "Jl. Kedungliwung No. 36, Ds. Kemiri",
      addressLocality: "Singojuruh, Banyuwangi", addressRegion: "Jawa Timur", addressCountry: "ID",
    },
    identifier: { "@type": "PropertyValue", propertyID: "NPSN", value: "69896523" },
    sameAs: [
      "https://www.instagram.com/smkalmunawwiriibs", "https://www.youtube.com/@SMKAl-MunawwirIIBS",
      "https://www.facebook.com/smkalmunawwiriibs", "https://www.tiktok.com/@smk.almunawwiriibs",
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(dataSekolah).replace(/</g, "\\u003c") }} />
      <Navbar transparent />
      <main>
        <Hero lang={lang} slideUtama={lang === "id" ? { title: s["school.tagline"], subtitle: s["school.hero_subtitle"] } : undefined} stats={{
          students: String(studentCount),
          majors: String(majorCount),
          foundedYear: s["stats.founded_year"],
          graduationRate: s["stats.graduation_rate"],
        }} />

        {/* Prayer times bar */}
        <div className="bg-primary-700 py-5">
          <div className="container-custom">
            <PrayerTimes />
          </div>
        </div>

        {story.length > 0 && (
          <section className="bg-white py-6">
            <div className="container-custom"><StoryGaleri story={story} gelap={false} /></div>
          </section>
        )}

        <Stats />
        <PitaKata kata={kata} />
        <Programs />
        <WhyChooseUs />

        {/* Islamic quote interlude */}
        <section className="py-16 bg-cream">
          <div className="container-custom max-w-2xl mx-auto">
            <IslamicQuote index={1} />
          </div>
        </section>

        <Testimonials lang={lang} data={testimoni} />
        <NewsPreview />
        <DeretLogo logo={logoMitra} judul={k.judulLogo || (lang === "id" ? "Mitra Industri & Kampus Alumni" : "Industry Partners & Alumni Universities")} />
        <StatistikPkl lang={lang} />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
