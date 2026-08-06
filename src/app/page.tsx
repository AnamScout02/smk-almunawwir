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
import { getLang } from "@/lib/lang";
import { getSettings } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";

export default async function HomePage() {
  const lang = await getLang();
  const [s, studentCount, majorCount] = await Promise.all([
    getSettings(["stats.founded_year", "stats.graduation_rate"]),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
    prisma.major.count().catch(() => 0),
  ]);
  return (
    <>
      <Navbar transparent />
      <main>
        <Hero lang={lang} stats={{
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

        <Stats />
        <Programs />
        <WhyChooseUs />

        {/* Islamic quote interlude */}
        <section className="py-16 bg-cream">
          <div className="container-custom max-w-2xl mx-auto">
            <IslamicQuote index={1} />
          </div>
        </section>

        <Testimonials lang={lang} />
        <NewsPreview />
        <CTABanner />
      </main>
      <Footer />
    </>
  );
}
