import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { programs } from "@/data/programs";
import {
  CheckCircle2,
  ArrowRight,
  Briefcase,
  Award,
  ChevronRight,
  Network,
  Calculator,
  Leaf,
  Palette,
  Building2,
} from "lucide-react";

export const dynamic = "force-dynamic";

const icons: Record<string, React.ElementType> = {
  tkj: Network,
  ak: Calculator,
  atu: Leaf,
  dkv: Palette,
  dpib: Building2,
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const program = programs.find((p) => p.slug === slug);
  if (!program) return { title: "Program tidak ditemukan" };
  return {
    title: `${program.name} (${program.code}) — SMK Al-Munawwir IIBS`,
    description: program.desc,
  };
}

export function generateStaticParams() {
  return programs.map((p) => ({ slug: p.slug }));
}

export default async function ProgramDetailPage({ params }: Props) {
  const { slug } = await params;
  const program = programs.find((p) => p.slug === slug);
  if (!program) notFound();

  const Icon = icons[program.slug] ?? Network;
  const otherPrograms = programs.filter((p) => p.slug !== slug);

  return (
    <>
      <Navbar />
      <main className="pt-20">
        {/* Hero */}
        <section className={`relative bg-gradient-to-br ${program.color} text-white section-padding overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white/5 rounded-full translate-x-1/3 translate-y-1/3" />
          <div className="container-custom relative">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-white/60 text-sm mb-8">
              <Link href="/" className="hover:text-white transition">Beranda</Link>
              <ChevronRight size={14} />
              <Link href="/programs" className="hover:text-white transition">Konsentrasi Keahlian</Link>
              <ChevronRight size={14} />
              <span className="text-white">{program.code}</span>
            </nav>

            <div className="flex items-start gap-5">
              <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl shrink-0">
                <Icon size={36} className="text-white" />
              </div>
              <div>
                <span className="text-white/70 text-sm font-semibold uppercase tracking-widest">{program.code}</span>
                <h1 className="font-heading text-3xl md:text-5xl font-bold mt-1 mb-3">
                  {program.name}
                </h1>
                <p className="text-white/80 text-lg max-w-2xl leading-relaxed">
                  {program.tagline}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="section-padding bg-cream">
          <div className="container-custom">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Left - Main Info */}
              <div className="lg:col-span-2 space-y-8">
                {/* Deskripsi */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-4">Tentang Konsentrasi Ini</h2>
                  <p className="text-gray-600 leading-relaxed text-base">{program.desc}</p>
                </div>

                {/* Kompetensi */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-6">Kompetensi yang Dipelajari</h2>
                  <ul className="grid sm:grid-cols-2 gap-3">
                    {program.skills.map((skill) => (
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
                    Peluang Karier
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {program.career.map((c) => (
                      <span key={c}
                        className={`px-4 py-2 rounded-full text-sm font-semibold bg-gradient-to-r ${program.color} text-white`}>
                        {c}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Foto / Galeri placeholder */}
                <div className="bg-white rounded-2xl p-7 shadow-sm">
                  <h2 className="font-heading text-2xl font-bold text-navy mb-6">Galeri Kegiatan</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i}
                        className={`aspect-video bg-gradient-to-br ${program.color} opacity-20 rounded-xl flex items-center justify-center`}>
                        <Icon size={28} className="text-gray-400" />
                      </div>
                    ))}
                  </div>
                  <p className="text-gray-400 text-sm text-center mt-4">Foto kegiatan akan segera tersedia</p>
                </div>
              </div>

              {/* Right - Sidebar */}
              <div className="space-y-6">
                {/* Keunggulan */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-heading font-bold text-navy mb-4">Keunggulan Program</h3>
                  <ul className="space-y-3">
                    {program.features.map((f) => (
                      <li key={f} className="flex items-center gap-3 text-sm">
                        <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${program.color} shrink-0`} />
                        <span className="text-gray-700">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Sertifikasi */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h3 className="font-heading font-bold text-navy mb-3">
                    <Award className="inline mr-2 text-gold" size={18} />
                    Sertifikasi
                  </h3>
                  <p className="text-sm text-gray-600">{program.cert}</p>
                </div>

                {/* Program Islami */}
                <div className="bg-gradient-to-br from-primary-800 to-primary-900 rounded-2xl p-6 text-white">
                  <p className="font-arabic text-gold text-xl mb-3">مَنْ طَلَبَ الْعِلْمَ</p>
                  <h3 className="font-heading font-bold mb-2">Program Islami Terintegrasi</h3>
                  <ul className="text-sm text-white/70 space-y-1.5 mt-3">
                    {["Tahfidz Al-Qur'an", "Bahasa Arab Intensif", "Kajian Fiqh & Aqidah", "Tilawah & Tahsin"].map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* CTA Daftar */}
                <div className="bg-primary-50 rounded-2xl p-6">
                  <h3 className="font-heading font-bold text-navy mb-2">Tertarik di {program.code}?</h3>
                  <p className="text-sm text-gray-600 mb-4">Daftar sekarang dan bergabunglah bersama ribuan alumni sukses kami.</p>
                  <Link href="/admissions"
                    className={`flex items-center justify-center gap-2 w-full bg-gradient-to-r ${program.color} text-white font-semibold py-3 rounded-xl hover:opacity-90 transition text-sm`}>
                    Daftar Sekarang
                    <ArrowRight size={16} />
                  </Link>
                  <Link href="/contact"
                    className="flex items-center justify-center gap-2 w-full border border-primary-200 text-primary-700 font-semibold py-3 rounded-xl hover:bg-primary-100 transition text-sm mt-2">
                    Tanya Informasi
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
                Konsentrasi Keahlian Lainnya
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {otherPrograms.map((p) => {
                const OtherIcon = icons[p.slug] ?? Network;
                return (
                  <Link key={p.slug} href={`/programs/${p.slug}`}
                    className="group bg-cream rounded-2xl p-5 hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
                    <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center mb-3`}>
                      <OtherIcon size={20} className="text-white" />
                    </div>
                    <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">{p.code}</div>
                    <div className="font-heading font-bold text-navy text-sm mt-0.5 leading-snug">{p.name}</div>
                    <div className="flex items-center gap-1 text-primary-700 text-xs font-semibold mt-3 group-hover:gap-2 transition-all">
                      Lihat Detail <ArrowRight size={12} />
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
