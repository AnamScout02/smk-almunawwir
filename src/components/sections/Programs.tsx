import Link from "next/link";
import Image from "next/image";
import { Network, Calculator, Leaf, Palette, Building2, GraduationCap, ArrowRight } from "lucide-react";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { prisma } from "@/lib/prisma";
import { themeGradient, themeGradientRight } from "@/lib/color";

const iconByCode: Record<string, React.ElementType> = {
  TKJ: Network, AK: Calculator, ATU: Leaf, DKV: Palette, DPIB: Building2,
};
const colorClassByCode: Record<string, string> = {
  TKJ: "from-blue-500 to-blue-700",
  AK: "from-orange-500 to-orange-700",
  ATU: "from-emerald-500 to-emerald-700",
  DKV: "from-purple-500 to-purple-700",
  DPIB: "from-teal-500 to-teal-700",
};

export default async function Programs() {
  const lang = await getLang();
  const tr = t(lang);
  const majors = await prisma.major.findMany({ orderBy: { name: "asc" } }).catch(() => []);
  return (
    <section className="section-padding bg-cream">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-14">
          <div>
            <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.programs_label}</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-navy mt-2">{tr.programs_heading}</h2>
            <p className="text-gray-500 mt-3 max-w-lg">{tr.programs_sub}</p>
          </div>
          <Link href="/programs" className="btn-primary whitespace-nowrap self-start md:self-auto">
            {tr.programs_view_all}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {majors.map((m) => {
            const customColor = m.themeColor;
            const Icon = iconByCode[m.code.toUpperCase()] ?? GraduationCap;
            const fallbackClass = colorClassByCode[m.code.toUpperCase()] ?? "from-primary-600 to-primary-800";
            const desc = m.tagline || m.description;
            const features = m.features?.length ? m.features : [];
            return (
            <div key={m.id}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className={`h-1.5 ${customColor ? "" : `bg-gradient-to-r ${fallbackClass}`}`}
                style={customColor ? { background: themeGradientRight(customColor) } : undefined} />
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`w-11 h-11 rounded-xl ${customColor ? "" : `bg-gradient-to-br ${fallbackClass}`} text-white shrink-0 flex items-center justify-center overflow-hidden relative`}
                    style={customColor ? { background: themeGradient(customColor) } : undefined}>
                    {m.logoUrl ? (
                      <Image src={m.logoUrl} alt={m.name} fill sizes="44px" className="object-contain p-1.5" unoptimized />
                    ) : (
                      <Icon size={22} />
                    )}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{m.code}</span>
                    <h3 className="font-heading font-bold text-navy text-base leading-tight">
                      {m.name}
                    </h3>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-5 leading-relaxed">{desc}</p>
                {features.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-5">
                    {features.map((f) => (
                      <span key={f} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">{f}</span>
                    ))}
                  </div>
                )}
                <Link href={`/programs/${m.code.toLowerCase()}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-gold transition-colors group-hover:gap-2.5">
                  {tr.programs_explore} <ArrowRight size={15} />
                </Link>
              </div>
            </div>
            );
          })}

          {/* Islamic programs card */}
          <div className="relative rounded-2xl p-6 text-white overflow-hidden bg-gradient-to-br from-primary-700 to-primary-900">
            <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
              style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "100px 100px", backgroundRepeat: "repeat", filter: "invert(1)" }}
            />
            <div className="relative">
              <p className="font-arabic text-gold text-2xl mb-3">إِقْرَأْ بِاسْمِ رَبِّكَ</p>
              <h3 className="font-heading text-xl font-bold mb-2">{tr.islamic_program_title}</h3>
              <p className="text-white/70 text-sm leading-relaxed mb-5">{tr.islamic_program_desc}</p>
              <div className="grid grid-cols-2 gap-3">
                {["Tahfidz Al-Qur'an", "Bahasa Arab", "Fiqh & Aqidah", "Tilawah"].map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-white/80">
                    <div className="w-1.5 h-1.5 rounded-full bg-gold" />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
