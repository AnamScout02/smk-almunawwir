import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import CekKelulusanForm from "@/components/sections/CekKelulusanForm";
import { GraduationCap } from "lucide-react";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cek Kelulusan — SMK Al Munawwir IIBS",
  description: "Cek status kelulusan siswa SMK Al Munawwir IIBS.",
};

const content = {
  id: {
    label: "Pengumuman Kelulusan",
    title: "Cek Kelulusan",
    desc: "Masukkan NIS dan tanggal lahir untuk melihat status kelulusan Anda.",
  },
  en: {
    label: "Graduation Announcement",
    title: "Check Graduation Status",
    desc: "Enter your Student ID (NIS) and date of birth to view your graduation status.",
  },
} as const;

export default async function CekKelulusanPage() {
  const lang = await getLang();
  const c = content[lang];
  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "254.56px 254.56px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mt-4 mb-4">
              <GraduationCap size={28} className="text-gold" />
            </div>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">{c.title}</h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">{c.desc}</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom max-w-md mx-auto">
            <CekKelulusanForm lang={lang} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
