export const dynamic = "force-dynamic";

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

export default async function HomePage() {
  const lang = await getLang();
  const [s, studentCount, majorCount] = await Promise.all([
    getSettings(["stats.founded_year", "stats.graduation_rate", "school.tagline", "school.hero_subtitle",
      "beranda.kataBerjalan", "beranda.testimoni", "spmb.fotoPromosi", "spmb.judulGaleri", "spmb.galeriLain", "spmb.logoMitra", "spmb.judulLogo"]),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
    prisma.major.count().catch(() => 0),
  ]);
  // Story & deret logo memakai bahan yang SUDAH diunggah panitia di Pusat SPMB → Poster & Promosi.
  const k = bacaKontenSpmb(s);
  const story = [
    ...(k.fotoPromosi.length ? [{ judul: k.judulGaleri || (lang === "id" ? "Galeri" : "Gallery"), foto: k.fotoPromosi }] : []),
    ...k.galeriLain.map(g => ({ judul: g.judul || (lang === "id" ? "Galeri" : "Gallery"), foto: g.foto })),
  ];
  // Kosong = pita disembunyikan (Konten Halaman → Keunggulan).
  const kata = (s["beranda.kataBerjalan"] ?? "").trim();
  const testimoni = bacaTestimoni(s["beranda.testimoni"]);
  return (
    <>
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
        <DeretLogo logo={k.logoMitra} judul={k.judulLogo || (lang === "id" ? "Mitra Industri & Kampus Alumni" : "Industry Partners & Alumni Universities")} />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
