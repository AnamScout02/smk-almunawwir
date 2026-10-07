import { Users, BookOpen, Award, GraduationCap, Building2, Globe } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { prisma } from "@/lib/prisma";
import StatCounter from "./StatCounter";
import TeksGerak from "@/components/gerak/TeksGerak";

export default async function Stats() {
  const lang = await getLang();
  const tr = t(lang);
  const [s, studentCount, majorCount] = await Promise.all([
    getSettings([
      "stats.achievements",
      "stats.graduation_rate",
      "stats.partners",
      "stats.founded_year",
    ]),
    prisma.student.count({ where: { studentStatus: "AKTIF" } }).catch(() => 0),
    prisma.major.count().catch(() => 0),
  ]);

  // Angka yang diisi admin (Konten Halaman) — kosong/0 = kartunya disembunyikan, BUKAN diganti angka karangan.
  const isian = (k: string) => parseInt(s[k] ?? "") || 0;
  const stats = [
    { icon: Users, value: studentCount, suffix: "+", label: tr.stat_students, desc: tr.stat_students_desc, accent: "text-emerald-400" },
    { icon: BookOpen, value: majorCount, suffix: "", label: tr.stat_majors, desc: tr.stat_majors_desc, accent: "text-blue-400" },
    { icon: Award, value: isian("stats.achievements"), suffix: "+", label: tr.stat_achievements, desc: tr.stat_achievements_desc, accent: "text-gold" },
    { icon: GraduationCap, value: isian("stats.graduation_rate"), suffix: "%", label: tr.stat_graduation, desc: tr.stat_graduation_desc, accent: "text-purple-400" },
    { icon: Building2, value: Math.max(new Date().getFullYear() - (parseInt(s["stats.founded_year"]) || 2014), 0), suffix: "", label: tr.stat_years, desc: `${tr.stat_years_desc} ${s["stats.founded_year"] || "2014"}`, accent: "text-amber-400" },
    { icon: Globe, value: isian("stats.partners"), suffix: "+", label: tr.stat_partners, desc: tr.stat_partners_desc, accent: "text-rose-400" },
  ].filter(x => x.value > 0);

  return (
    <section className="tekstur-noise section-padding relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 50%, #1B2B6B 100%)" }}>
      <div className="latar-aurora" aria-hidden />
      {/* Decorative pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "197.99px 197.99px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
      {/* Gold accent line top */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
      {/* Glow orbs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(232,160,32,0.4) 0%, transparent 70%)" }} />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)" }} />

      <div className="container-custom relative">
        <div className="text-center mb-14">
          <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.stats_label}</span>
          <h2 className="gerak-judul font-heading text-3xl md:text-4xl font-bold text-white mt-2"><TeksGerak teks={tr.stats_heading} /></h2>
          <p className="text-white/50 mt-3 max-w-xl mx-auto">{tr.stats_sub}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5 lg:gap-6">
          {stats.map(({ icon: Icon, value, suffix, label, desc, accent }, i) => (
            <div
              key={label}
              style={{ ["--tunda" as string]: `${i * 90}ms`, background: "rgba(255,255,255,0.05)", backdropFilter: "blur(8px)" }}
              className="gerak-naik sorot-kursor group relative rounded-2xl border border-white/10 hover:border-gold/40 transition-all duration-300 text-center overflow-hidden">
              {/* hover glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                style={{ background: "radial-gradient(circle at 50% 0%, rgba(232,160,32,0.08) 0%, transparent 70%)" }} />
              <div className="relative p-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-all duration-300 group-hover:scale-110"
                  style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}>
                  <Icon size={26} className={`${accent} transition-colors duration-300`} />
                </div>
                <div className={`font-heading text-3xl md:text-4xl font-bold ${accent} mb-1`}>
                  <StatCounter target={value} suffix={suffix} />
                </div>
                <div className="font-semibold text-white mb-1 text-sm">{label}</div>
                <div className="text-white/40 text-xs">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
