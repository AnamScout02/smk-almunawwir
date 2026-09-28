import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TracerStudyForm from "@/components/sections/TracerStudyForm";
import { GraduationCap } from "lucide-react";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tracer Study Alumni — SMK Al Munawwir IIBS",
  description: "Formulir isian mandiri untuk alumni SMK Al Munawwir IIBS — bagikan kabar terbaru Anda setelah lulus.",
};

const TEKS = {
  id: {
    judul: "Tracer Study Alumni",
    isi: "Bagikan kabar terbaru Anda setelah lulus dari SMK Al Munawwir IIBS — sedang bekerja, kuliah, atau berwirausaha. Data ini membantu sekolah memantau keterserapan lulusan.",
  },
  en: {
    judul: "Alumni Tracer Study",
    isi: "Share your latest news after graduating from SMK Al Munawwir IIBS — working, studying, or running a business. This data helps the school track where its graduates go.",
  },
};

export default async function TracerStudyPage() {
  const lang = await getLang();
  const c = TEKS[lang];
  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">Alumni</span>
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mt-4 mb-4">
              <GraduationCap size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">{c.judul}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">{c.isi}</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-xl mx-auto">
            <TracerStudyForm lang={lang} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
