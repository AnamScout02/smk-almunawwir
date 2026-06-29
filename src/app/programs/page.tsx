import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { programs } from "@/data/programs";
import { Network, Palette, Calculator, Leaf, Building2, CheckCircle2, ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Konsentrasi Keahlian — SMK Al-Munawwir IIBS",
  description: "5 konsentrasi keahlian unggulan SMK Al-Munawwir IIBS — TKJ, AK, ATU, DKV, DPIB.",
};

const icons: Record<string, React.ElementType> = {
  tkj: Network,
  ak: Calculator,
  atu: Leaf,
  dkv: Palette,
  dpib: Building2,
};

export default function ProgramsPage() {
  return (
    <>
      <Navbar />
      <main className="pt-20">
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white section-padding">
          <div className="container-custom max-w-2xl">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">Konsentrasi Keahlian</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">
              5 Jurusan Unggulan
            </h1>
            <p className="text-white/70 text-lg">
              Pilih jurusan sesuai minat dan bakat Anda. Semua program dilengkapi
              praktik industri, sertifikasi nasional, dan pembinaan Islami terintegrasi.
            </p>
          </div>
        </section>

        <div className="section-padding bg-cream">
          <div className="container-custom space-y-12">
            {programs.map((p, i) => {
              const Icon = icons[p.slug] ?? Network;
              return (
                <div key={p.slug} id={p.slug}
                  className="grid lg:grid-cols-2 gap-8 items-center">
                  <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                    <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${p.color} text-white px-4 py-2 rounded-full text-sm font-bold mb-4`}>
                      <Icon size={16} />
                      {p.code}
                    </div>
                    <h2 className="font-heading text-2xl md:text-3xl font-bold text-navy mb-2">{p.name}</h2>
                    <p className="text-gold font-medium mb-4">{p.tagline}</p>
                    <p className="text-gray-600 leading-relaxed mb-5">{p.desc}</p>
                    <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-4 py-2 rounded-xl text-sm font-semibold mb-5">
                      <CheckCircle2 size={16} />
                      {p.cert}
                    </div>
                    <div>
                      <Link href={`/programs/${p.slug}`}
                        className={`inline-flex items-center gap-2 bg-gradient-to-r ${p.color} text-white font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition text-sm`}>
                        Lihat Detail Lengkap
                        <ArrowRight size={16} />
                      </Link>
                    </div>
                  </div>

                  <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                    <div className="bg-white rounded-3xl p-6 shadow-sm">
                      <div className="mb-5">
                        <h3 className="font-heading font-bold text-navy mb-3">Kompetensi yang Dipelajari</h3>
                        <ul className="space-y-2">
                          {p.skills.map((s) => (
                            <li key={s} className="flex items-center gap-2.5 text-sm text-gray-600">
                              <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${p.color} shrink-0`} />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-gray-100 pt-5">
                        <h3 className="font-heading font-bold text-navy mb-3">Peluang Karier</h3>
                        <div className="flex flex-wrap gap-2">
                          {p.career.map((c) => (
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
