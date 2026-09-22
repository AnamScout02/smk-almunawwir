import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { programs } from "@/data/programs";
import { prisma } from "@/lib/prisma";
import { themeGradient, themeGradientRight } from "@/lib/color";
import { CheckCircle2, ArrowRight, Briefcase, Award, ChevronRight, Network, Calculator, Leaf, Palette, Building2, GraduationCap } from "lucide-react";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

const icons: Record<string, React.ElementType> = {
  tkj: Network,
  ak: Calculator,
  atu: Leaf,
  dkv: Palette,
  dpib: Building2,
};

const staticBySlug = Object.fromEntries(programs.map(p => [p.slug, p]));

const content = {
  id: {
    home: "Beranda",
    programsCrumb: "Konsentrasi Keahlian",
    aboutTitle: "Tentang Konsentrasi Ini",
    skillsTitle: "Kompetensi yang Dipelajari",
    careerTitle: "Peluang Karier",
    galleryTitle: "Galeri Kegiatan",
    galleryEmpty: "Foto kegiatan akan segera tersedia",
    featuresTitle: "Keunggulan Program",
    certTitle: "Sertifikasi",
    islamicTitle: "Program Islami Terintegrasi",
    islamicItems: ["Tahfidz Al-Qur'an", "Bahasa Arab Intensif", "Kajian Fiqh & Aqidah", "Tilawah & Tahsin"],
    interestedTitle: (code: string) => `Tertarik di ${code}?`,
    interestedDesc: "Daftar sekarang dan bergabunglah bersama ribuan alumni sukses kami.",
    registerBtn: "Daftar Sekarang",
    askBtn: "Tanya Informasi",
    otherProgramsTitle: "Konsentrasi Keahlian Lainnya",
    viewDetail: "Lihat Detail",
  },
  en: {
    home: "Home",
    programsCrumb: "Areas of Expertise",
    aboutTitle: "About This Program",
    skillsTitle: "Competencies Learned",
    careerTitle: "Career Opportunities",
    galleryTitle: "Activity Gallery",
    galleryEmpty: "Activity photos coming soon",
    featuresTitle: "Program Advantages",
    certTitle: "Certification",
    islamicTitle: "Integrated Islamic Program",
    islamicItems: ["Qur'an Memorization", "Intensive Arabic", "Fiqh & Aqidah Studies", "Tilawah & Tahsin"],
    interestedTitle: (code: string) => `Interested in ${code}?`,
    interestedDesc: "Register now and join thousands of our successful alumni.",
    registerBtn: "Register Now",
    askBtn: "Ask for Information",
    otherProgramsTitle: "Other Areas of Expertise",
    viewDetail: "View Detail",
  },
} as const;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const major = await prisma.major.findFirst({ where: { code: { equals: slug, mode: "insensitive" } } }).catch(() => null);
  if (!major) return { title: "Program tidak ditemukan" };
  return {
    title: `${major.name} (${major.code}) — SMK Al Munawwir IIBS`,
    description: major.description,
  };
}

export default async function ProgramDetailPage({ params }: Props) {
  const { slug } = await params;
  const lang = await getLang();
  const c = content[lang];

  const majors = await prisma.major.findMany({ include: { gallery: { orderBy: { order: "asc" } } }, orderBy: { name: "asc" } }).catch(() => []);
  const dbMajor = majors.find(m => m.code.toLowerCase() === slug.toLowerCase());
  if (!dbMajor) notFound();

  const program = staticBySlug[slug.toLowerCase()];
  const Icon = icons[slug.toLowerCase()] ?? GraduationCap;
  const otherMajors = majors.filter((m) => m.code.toLowerCase() !== slug.toLowerCase());

  const logoUrl = dbMajor.logoUrl ?? undefined;
  const customColor = dbMajor.themeColor;
  const fallbackClass = program?.color ?? "from-primary-700 to-primary-900";
  const heroStyle = customColor ? { background: themeGradient(customColor) } : undefined;
  const rightStyle = customColor ? { background: themeGradientRight(customColor) } : undefined;

  const name = dbMajor.name;
  const code = dbMajor.code;
  const tagline = dbMajor.tagline || program?.tagline || "";
  const desc = dbMajor.longDesc || program?.desc || dbMajor.description;
  const skills = dbMajor.skills?.length ? dbMajor.skills : program?.skills ?? [];
  const career = dbMajor.career?.length ? dbMajor.career : program?.career ?? [];
  const cert = dbMajor.cert || program?.cert || "";
  const features = dbMajor.features?.length ? dbMajor.features : program?.features ?? [];
  const gallery = dbMajor.gallery ?? [];

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Hero */}
        <section className={`relative ${customColor ? "" : `bg-gradient-to-br ${fallbackClass}`} text-white section-padding overflow-hidden`}
          style={heroStyle}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "160px 160px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="container-custom relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-white/60 text-sm mb-8">
              <Link href="/" className="hover:text-white transition">{c.home}</Link>
              <ChevronRight size={14} />
              <Link href="/programs" className="hover:text-white transition">{c.programsCrumb}</Link>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              <span className="text-white">{code}</span>
            </nav>

            <div className="flex items-center gap-6">
              <div className="w-24 h-24 p-4 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0 flex items-center justify-center overflow-hidden relative">
                {logoUrl ? (
                  <Image src={logoUrl} alt={name} fill sizes="96px" className="object-contain p-3" />
                ) : (
                  <Icon size={48} className="text-white" />
                )}
              </div>
              <div>
                <span className="text-white/70 text-sm font-semibold uppercase tracking-widest">{code}</span>
                <h1 className="font-heading text-3xl md:text-5xl font-bold mt-1 mb-3">
                  {name}
                </h1>
                <p className="text-white/80 text-lg max-w-2xl leading-relaxed">
                  {tagline}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="section-padding bg-cream">
          <div className="container-custom">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left - Main Info */}
              <div className="lg:col-span-2 space-y-8">
                {/* Deskripsi */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-4">{c.aboutTitle}</h2>
                  <p className="text-gray-600 leading-relaxed text-base">{desc}</p>
                </div>

                {/* Kompetensi */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-6">{c.skillsTitle}</h2>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {skills.map((skill) => (
                      <li key={skill} className="flex items-start gap-3">
                        <CheckCircle2 size={18} className={`mt-0.5 shrink-0 text-emerald-500`} />
                        <span className="text-gray-700 text-sm">{skill}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Karier */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-6">
                    <Briefcase className="inline mr-2 text-primary-700" size={22} />
                    {c.careerTitle}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {career.map((c) => (
                      <span key={c}
                        className={`px-4 py-2 rounded-full text-sm font-semibold ${customColor ? "" : `bg-gradient-to-r ${fallbackClass}`} text-white`}
                        style={rightStyle}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Foto / Galeri Kegiatan */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-6">{c.galleryTitle}</h2>
                  {gallery.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {gallery.map((g) => (
                        <div key={g.id} className="aspect-video rounded-xl overflow-hidden relative">
                          <Image src={g.imageUrl} alt={g.caption ?? name} fill sizes="(max-width: 768px) 50vw, 33vw" className="object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                          logoUrl ? (
                            <div key={i}
                              className={`aspect-video ${customColor ? "" : `bg-gradient-to-br ${fallbackClass}`} rounded-xl flex items-center justify-center overflow-hidden relative`}
                              style={heroStyle}>
                              <div className="absolute inset-0 opacity-[0.1] pointer-events-none"
                                style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "60px 60px", backgroundRepeat: "repeat", filter: "invert(1)" }}
                              />
                              <Image src={logoUrl} alt={name} fill sizes="120px" className="object-contain p-6" />
                            </div>
                          ) : (
                            <div key={i}
                              className={`aspect-video ${customColor ? "" : `bg-gradient-to-br ${fallbackClass}`} opacity-20 rounded-xl flex items-center justify-center`}
                              style={heroStyle}>
                              <Icon size={28} className="text-gray-400" />
                            </div>
                          )
                        ))}
                      </div>
                      <p className="text-gray-400 text-sm text-center mt-4">{c.galleryEmpty}</p>
                    </>
                  )}
                </div>
              </div>

              {/* Right - Sidebar */}
              <div className="space-y-6">
                {/* Keunggulan */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-heading font-bold text-navy mb-4">{c.featuresTitle}</h3>
                  <ul className="space-y-3">
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full ${customColor ? "" : `bg-gradient-to-r ${fallbackClass}`} shrink-0`}
                          style={rightStyle} />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sertifikasi */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-heading font-bold text-navy mb-3">
                    <Award className="inline mr-2 text-gold" size={18} />
                    {c.certTitle}
                  </h3>
                  <p className="text-sm text-gray-600">{cert}</p>
                </div>

                {/* Program Islami */}
                <div className="relative rounded-2xl overflow-hidden p-6 text-white"
                  style={{
                    background: "linear-gradient(160deg, #0F1A45 0%, #1B2B6B 50%, #0A1030 100%)",
                    boxShadow: "0 8px 40px rgba(15,26,69,0.25), 0 0 0 1px rgba(232,160,32,0.2)"
                  }}>
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
                    style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
                  <div className="relative">
                    <p className="font-arabic text-gold text-xl mb-3">مَنْ طَلَبَ الْعِلْمَ</p>
                    <h3 className="font-heading font-bold mb-2">{c.islamicTitle}</h3>
                    <ul className="text-sm text-white/70 space-y-1.5 mt-3">
                      {c.islamicItems.map((f) => (
                        <li key={f} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* CTA Daftar */}
                <div className="bg-primary-50 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-navy mb-2">{c.interestedTitle(code)}</h3>
                  <p className="text-sm text-gray-600 mb-4">{c.interestedDesc}</p>
                  <Link href="/admissions"
                    className={`flex items-center justify-center gap-2 w-full ${customColor ? "" : `bg-gradient-to-r ${fallbackClass}`} text-white font-semibold py-3 rounded-xl hover:opacity-90 transition text-sm`}
                    style={rightStyle}>
                    {c.registerBtn}
                    <ArrowRight size={16} />
                  </Link>
                  <Link href="/contact"
                    className="flex items-center justify-center gap-2 w-full border border-primary-100 text-primary-700 font-semibold py-3 rounded-xl hover:bg-primary-100 transition text-sm mt-2">
                    {c.askBtn}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Other Programs */}
        <section className="section-padding bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <h2 className="font-heading text-2xl md:text-3xl font-bold text-navy">
                {c.otherProgramsTitle}
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {otherMajors.map((m) => {
                const otherSlug = m.code.toLowerCase();
                const otherStatic = staticBySlug[otherSlug];
                const OtherIcon = icons[otherSlug] ?? GraduationCap;
                const otherFallback = otherStatic?.color ?? "from-primary-700 to-primary-900";
                return (
                  <Link key={m.id} href={`/programs/${otherSlug}`}
                    className="group block bg-cream rounded-2xl p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                    <div className={`w-11 h-11 rounded-xl ${m.themeColor ? "" : `bg-gradient-to-br ${otherFallback}`} flex items-center justify-center mb-3 overflow-hidden relative`}
                      style={m.themeColor ? { background: themeGradient(m.themeColor) } : undefined}>
                      {m.logoUrl ? (
                        <Image src={m.logoUrl} alt={m.name} fill sizes="44px" className="object-contain p-1.5" />
                      ) : (
                        <OtherIcon size={20} className="text-white" />
                      )}
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.code}</div>
                    <div className="font-heading font-bold text-navy text-sm mt-0.5 leading-snug">{m.name}</div>
                    <div className="flex items-center gap-1 text-primary-700 text-xs font-semibold mt-3 group-hover:gap-2 transition-all">
                      {c.viewDetail} <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
