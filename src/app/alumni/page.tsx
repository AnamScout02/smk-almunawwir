import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import Link from "next/link";
import { GraduationCap, Quote } from "lucide-react";
import { getLang } from "@/lib/lang";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Alumni — SMK Al Munawwir IIBS",
  description: "Kisah sukses alumni SMK Al Munawwir IIBS yang telah berkarir dan melanjutkan pendidikan di berbagai bidang.",
};

const content = {
  id: {
    heroLabel: "Kebanggaan Kami",
    heroTitle: "Alumni Berprestasi",
    heroDesc: "Kisah nyata lulusan SMK Al Munawwir IIBS yang telah berhasil berkarir, berwirausaha, dan melanjutkan pendidikan — membawa bekal ilmu dan akhlak Islami.",
    testimonialsLabel: "Kata Mereka",
    testimonialsTitle: "Cerita Sukses Alumni",
    destinationsLabel: "Setelah Lulus",
    destinationsTitle: "Kemana Alumni Kami Pergi",
    ctaAlumniTitle: "Kamu Alumni Al Munawwir?",
    ctaAlumniDesc: "Bagikan kisah suksesmu dan jadilah inspirasi bagi adik-adik kelas. Hubungi kami untuk bergabung di komunitas alumni.",
    ctaAlumniBtn: "Hubungi Kami",
    ctaRegTitle: "Jadilah Bagian dari Cerita Ini",
    ctaRegDesc: "Daftar sekarang dan mulai perjalananmu menuju masa depan yang cerah bersama SMK Al Munawwir IIBS.",
    ctaRegBtn: "Daftar Sekarang",
    ctaProgramsBtn: "Lihat Program Studi",
    testimonialsEmpty: "Testimoni alumni akan tampil di sini setelah alumni mengisi Tracer Study.",
    destinationsEmpty: "Data tujuan alumni akan tampil di sini setelah data Tracer Study terkumpul.",
    noDataYet: "Segera hadir",
    respondentSub: "Alumni mengisi Tracer Study",
  },
  en: {
    heroLabel: "Our Pride",
    heroTitle: "Accomplished Alumni",
    heroDesc: "Real stories of SMK Al Munawwir IIBS graduates who have built careers, started businesses, and continued their education — carrying with them knowledge and Islamic character.",
    testimonialsLabel: "What They Say",
    testimonialsTitle: "Alumni Success Stories",
    destinationsLabel: "After Graduation",
    destinationsTitle: "Where Our Alumni Go",
    ctaAlumniTitle: "Are You an Al Munawwir Alumnus?",
    ctaAlumniDesc: "Share your success story and inspire our younger students. Contact us to join the alumni community.",
    ctaAlumniBtn: "Contact Us",
    ctaRegTitle: "Be Part of This Story",
    ctaRegDesc: "Register now and start your journey toward a bright future with SMK Al Munawwir IIBS.",
    ctaRegBtn: "Register Now",
    ctaProgramsBtn: "View Study Programs",
    testimonialsEmpty: "Alumni testimonials will appear here once alumni fill out the Tracer Study.",
    destinationsEmpty: "Alumni destination data will appear here once Tracer Study data is collected.",
    noDataYet: "Coming soon",
    respondentSub: "Alumni who completed the Tracer Study",
  },
} as const;

const TESTIMONIAL_COLORS = ["bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-lime-600", "bg-amber-500", "bg-rose-500"];

const STATUS_LABEL: Record<string, { id: { title: string; icon: string }; en: { title: string; icon: string } }> = {
  BEKERJA: { id: { title: "Bekerja", icon: "💼" }, en: { title: "Employed", icon: "💼" } },
  KULIAH: { id: { title: "Melanjutkan Kuliah", icon: "🎓" }, en: { title: "Continuing to College", icon: "🎓" } },
  WIRAUSAHA: { id: { title: "Wirausaha", icon: "🏪" }, en: { title: "Entrepreneurship", icon: "🏪" } },
  BELUM_BEKERJA: { id: { title: "Belum Bekerja", icon: "⏳" }, en: { title: "Not Yet Employed", icon: "⏳" } },
  LAINNYA: { id: { title: "Lainnya", icon: "📌" }, en: { title: "Other", icon: "📌" } },
};

export default async function AlumniPage() {
  const lang = await getLang();
  const c = content[lang];

  const [totalLulusan, tracers] = await Promise.all([
    prisma.student.count({ where: { studentStatus: "LULUS" } }).catch(() => 0),
    prisma.alumniTracer.findMany({
      include: { student: { include: { user: { select: { name: true } }, major: { select: { code: true } }, class: { select: { grade: true } } } } },
      orderBy: { surveyDate: "desc" },
    }).catch(() => []),
  ]);

  const totalResponses = tracers.length;
  const employedCount = tracers.filter(tr => ["BEKERJA", "KULIAH", "WIRAUSAHA"].includes(tr.status)).length;
  const employedRate = totalResponses > 0 ? Math.round((employedCount / totalResponses) * 100) : null;
  const partnerCount = new Set(tracers.filter(tr => tr.institutionName).map(tr => tr.institutionName)).size;
  const angkatanCount = new Set(tracers.map(tr => tr.surveyDate.getFullYear())).size;

  const stats = [
    { value: employedRate !== null ? `${employedRate}%` : c.noDataYet, label: lang === "en" ? "Employed / Enrolled" : "Terserap Kerja / Kuliah", sub: c.respondentSub },
    { value: totalResponses > 0 ? `${totalResponses}` : c.noDataYet, label: lang === "en" ? "Tracer Study Respondents" : "Alumni Mengisi Tracer Study", sub: `${totalLulusan} ${lang === "en" ? "total graduates" : "total lulusan"}` },
    { value: angkatanCount > 0 ? `${angkatanCount}` : c.noDataYet, label: lang === "en" ? "Graduating Classes" : "Angkatan Terdata", sub: c.respondentSub },
    { value: partnerCount > 0 ? `${partnerCount}+` : c.noDataYet, label: lang === "en" ? "Partner Institutions" : "Institusi Mitra", sub: lang === "en" ? "Where alumni work/study" : "Tempat alumni bekerja/kuliah" },
  ];

  const testimonials = tracers
    .filter(tr => tr.notes && tr.notes.trim().length > 0)
    .slice(0, 6)
    .map(tr => ({
      name: tr.student.user.name,
      major: tr.student.major.code,
      role: tr.position || "",
      company: tr.institutionName || "",
      quote: tr.notes as string,
      initial: tr.student.user.name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase(),
    }));

  const destinations = Object.entries(
    tracers.reduce<Record<string, string[]>>((acc, tr) => {
      if (!tr.institutionName) return acc;
      (acc[tr.status] ??= []).push(tr.institutionName);
      return acc;
    }, {})
  ).map(([status, places]) => ({
    category: STATUS_LABEL[status]?.[lang]?.title ?? status,
    icon: STATUS_LABEL[status]?.[lang]?.icon ?? "📌",
    places: [...new Set(places)].slice(0, 5),
  }));

  return (
    <>
      <Navbar />
      <main className="min-h-dvh">
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

        {/* Stats */}
        <section className="py-12 bg-white border-b border-gray-100">
          <div className="container-custom">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {stats.map(({ value, label, sub }) => (
                <div key={label}>
                  <p className="font-heading font-bold text-3xl text-primary-700 mb-1">{value}</p>
                  <p className="font-semibold text-sm text-navy">{label}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="py-16 bg-cream">
          <div className="container-custom">
            <div className="text-center mb-12">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.testimonialsLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.testimonialsTitle}</h2>
            </div>
            {testimonials.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {testimonials.map((alum, i) => (
                  <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
                    <Quote size={24} className="text-gold/40 mb-3" />
                    <p className="text-gray-600 text-sm leading-relaxed flex-1 mb-6 italic">
                      &ldquo;{alum.quote}&rdquo;
                    </p>
                    <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                      <div className={`w-10 h-10 rounded-full ${TESTIMONIAL_COLORS[i % TESTIMONIAL_COLORS.length]} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
                        {alum.initial}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-navy truncate">{alum.name}</p>
                        {(alum.role || alum.company) && (
                          <p className="text-xs text-gray-400 truncate">{[alum.role, alum.company].filter(Boolean).join(" · ")}</p>
                        )}
                        <span className="inline-block text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold mt-0.5">{alum.major}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-10">{c.testimonialsEmpty}</p>
            )}
          </div>
        </section>

        {/* Destinations */}
        <section className="py-16 bg-white">
          <div className="container-custom">
            <div className="text-center mb-10">
              <span className="text-primary-700 text-sm font-semibold uppercase tracking-widest">{c.destinationsLabel}</span>
              <h2 className="font-heading text-3xl font-bold text-navy mt-2">{c.destinationsTitle}</h2>
            </div>
            {destinations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {destinations.map(({ category, icon, places }) => (
                  <div key={category} className="bg-gray-50 rounded-2xl p-6">
                    <div className="text-3xl mb-3">{icon}</div>
                    <h3 className="font-heading font-bold text-navy text-lg mb-4 flex items-center gap-2">
                      {category}
                    </h3>
                    <ul className="space-y-2">
                      {places.map(p => (
                        <li key={p} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="text-gold mt-0.5">·</span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm py-10 max-w-md mx-auto">{c.destinationsEmpty}</p>
            )}
          </div>
        </section>

        {/* CTA for Alumni */}
        <section className="py-12 bg-primary-50 border-y border-primary-100">
          <div className="container-custom text-center">
            <h3 className="font-heading font-bold text-2xl text-navy mb-3">{c.ctaAlumniTitle}</h3>
            <p className="text-gray-500 mb-6 max-w-lg mx-auto text-sm">
              {c.ctaAlumniDesc}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/contact"
                className="btn-primary">
                {c.ctaAlumniBtn}
              </Link>
              <Link href="/tracer-study"
                className="btn-modal-cancel">
                Isi Tracer Study
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Register */}
        <section className="py-16 bg-primary-900 text-white text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom relative">
            <GraduationCap size={48} className="text-gold mx-auto mb-4" />
            <h2 className="font-heading text-3xl font-bold mb-3">{c.ctaRegTitle}</h2>
            <p className="text-white/70 mb-8 max-w-lg mx-auto">
              {c.ctaRegDesc}
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Link href="/admissions"
                className="px-8 py-3 rounded-full bg-gold hover:bg-gold/90 text-primary-900 font-bold transition">
                {c.ctaRegBtn}
              </Link>
              <Link href="/programs"
                className="px-8 py-3 rounded-full border border-white/30 text-white hover:bg-white/10 transition font-semibold">
                {c.ctaProgramsBtn}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
