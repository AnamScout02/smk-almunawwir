import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { programs } from "@/data/programs";
import { prisma } from "@/lib/prisma";
import { Network, Palette, Calculator, Leaf, Building2, CheckCircle2, ArrowRight } from "lucide-react";
import { themeGradientRight } from "@/lib/color";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Konsentrasi Keahlian — SMK Al Munawwir IIBS",
  description: "5 konsentrasi keahlian unggulan SMK Al Munawwir IIBS — TKJ, AK, ATU, DKV, DPIB.",
};

const icons: Record<string, React.ElementType> = {
  tkj: Network,
  ak: Calculator,
  atu: Leaf,
  dkv: Palette,
  dpib: Building2,
};

const content = {
  id: {
    label: "Konsentrasi Keahlian",
    title: "5 Jurusan Unggulan",
    desc: "Pilih jurusan sesuai minat dan bakat Anda. Semua program dilengkapi praktik industri, sertifikasi nasional, dan pembinaan Islami terintegrasi.",
    skillsTitle: "Kompetensi yang Dipelajari",
    careerTitle: "Peluang Karier",
    detailBtn: "Lihat Detail Lengkap",
  },
  en: {
    label: "Areas of Expertise",
    title: "5 Leading Majors",
    desc: "Choose a major that fits your interests and talents. All programs include industry practice, national certification, and integrated Islamic development.",
    skillsTitle: "Competencies Learned",
    careerTitle: "Career Opportunities",
    detailBtn: "View Full Details",
  },
} as const;

export default async function ProgramsPage() {
  const lang = await getLang();
  const c = content[lang];
  let logoByCode: Record<string, string> = {};
  let majorByCode: Record<string, Awaited<ReturnType<typeof prisma.major.findFirst>>> = {};
  try {
    const majors = await prisma.major.findMany();
    logoByCode = Object.fromEntries(
      majors.filter(m => m.logoUrl).map(m => [m.code.toUpperCase(), m.logoUrl as string])
    );
    majorByCode = Object.fromEntries(majors.map(m => [m.code.toUpperCase(), m]));
  } catch {
    // DB unavailable — pakai data statis di bawah
  }
  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">
              {c.title}
            </h1>
            <p className="text-white/70 text-lg max-w-2xl mx-auto">
              {c.desc}
            </p>
          </div>
        </section>

        <div className="section-padding bg-cream">
          <div className="container-custom space-y-12">
            {programs.map((p, i) => {
              const Icon = icons[p.slug] ?? Network;
              const db = majorByCode[p.code.toUpperCase()];
              const tagline = db?.tagline || p.tagline;
              const desc = db?.longDesc || p.desc;
              const cert = db?.cert || p.cert;
              const skills = db?.skills?.length ? db.skills : p.skills;
              const career = db?.career?.length ? db.career : p.career;
              const customColor = db?.themeColor;
              const gradientStyle = customColor ? { background: themeGradientRight(customColor) } : undefined;
              return (
                <div key={p.slug} id={p.slug}
                  className="grid lg:grid-cols-2 gap-8 items-center">
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className={`inline-flex items-center gap-2 ${customColor ? "" : `bg-gradient-to-r ${p.color}`} text-white px-4 py-2 rounded-full text-sm font-bold mb-4`}
                      style={gradientStyle}>
                      {logoByCode[p.code] ? (
                        <span className="relative w-4 h-4 shrink-0">
                          <Image src={logoByCode[p.code]} alt={p.name} fill sizes="16px" className="object-contain rounded-full" unoptimized />
                        </span>
                      ) : (
                        <Icon size={16} />
                      )}
                      {p.code}
                    </div>
                    <h2 className="font-heading text-2xl md:text-3xl font-bold text-navy mb-2">{p.name}</h2>
                    <p className="text-gold font-medium mb-4">{tagline}</p>
                    <p className="text-gray-600 leading-relaxed mb-5">{desc}</p>
                    <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-xl text-sm font-semibold mb-5">
                      <CheckCircle2 size={16} />
                      {cert}
                    </div>
                    <div>
                      <Link href={`/programs/${p.slug}`}
                        className={`inline-flex items-center gap-2 ${customColor ? "" : `bg-gradient-to-r ${p.color}`} text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition text-sm`}
                        style={gradientStyle}>
                        {c.detailBtn}
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>

                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="bg-white rounded-3xl p-6 shadow-sm">
                      <div className="mb-5">
                        <h3 className="font-heading font-bold text-navy mb-3">{c.skillsTitle}</h3>
                        <ul className="space-y-2">
                          {skills.map((s) => (
                            <li key={s} className="flex items-center gap-2.5 text-sm text-gray-600">
                              <div className={`w-2 h-2 rounded-full ${customColor ? "" : `bg-gradient-to-r ${p.color}`} shrink-0`}
                                style={gradientStyle} />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-gray-100 pt-5">
                        <h3 className="font-heading font-bold text-navy mb-3">{c.careerTitle}</h3>
                        <div className="flex flex-wrap gap-2">
                          {career.map((c) => (
                            <span key={c} className="text-xs bg-primary-50 text-primary-700 px-3 py-1.5 rounded-full font-medium">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
