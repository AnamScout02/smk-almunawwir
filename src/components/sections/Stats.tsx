import { Users, BookOpen, Award, GraduationCap, Building2, Globe } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import StatCounter from "./StatCounter";

export default async function Stats() {
  const lang = await getLang();
  const tr = t(lang);
  const s = await getSettings([
    "stats.students",
    "stats.achievements",
    "stats.graduation_rate",
    "stats.years",
    "stats.partners",
    "stats.founded_year",
  ]);

  const stats = [
    { icon: Users, value: parseInt(s["stats.students"]) || 1200, suffix: "+", label: tr.stat_students, desc: tr.stat_students_desc },
    { icon: BookOpen, value: 5, suffix: "", label: tr.stat_majors, desc: tr.stat_majors_desc },
    { icon: Award, value: parseInt(s["stats.achievements"]) || 50, suffix: "+", label: tr.stat_achievements, desc: tr.stat_achievements_desc },
    { icon: GraduationCap, value: parseInt(s["stats.graduation_rate"]) || 98, suffix: "%", label: tr.stat_graduation, desc: tr.stat_graduation_desc },
    { icon: Building2, value: parseInt(s["stats.years"]) || 12, suffix: "", label: tr.stat_years, desc: `${tr.stat_years_desc} ${s["stats.founded_year"] || "2014"}` },
    { icon: Globe, value: parseInt(s["stats.partners"]) || 30, suffix: "+", label: tr.stat_partners, desc: tr.stat_partners_desc },
  ];

  return (
    <section className="section-padding bg-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary-50 rounded-full -translate-x-1/2 -translate-y-1/2 opacity-50" />
      <div className="absolute bottom-0 right-0 w-48 h-48 bg-gold/10 rounded-full translate-x-1/3 translate-y-1/3" />

      <div className="container-custom relative">
        <div className="text-center mb-14">
          <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.stats_label}</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-navy mt-2">{tr.stats_heading}</h2>
          <p className="text-gray-500 mt-3 max-w-xl mx-auto">{tr.stats_sub}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8">
          {stats.map(({ icon: Icon, value, suffix, label, desc }) => (
            <div
              key={label}
              className="group p-6 rounded-2xl border border-gray-100 hover:border-gold/30 hover:shadow-lg transition-all duration-300 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-primary-50 group-hover:bg-primary-700 flex items-center justify-center mx-auto mb-4 transition-colors duration-300">
                <Icon size={26} className="text-primary-700 group-hover:text-gold transition-colors duration-300" />
              </div>
              <div className="font-heading text-3xl md:text-4xl font-bold text-primary-700 mb-1">
                <StatCounter target={value} suffix={suffix} />
              </div>
              <div className="font-semibold text-navy mb-1">{label}</div>
              <div className="text-gray-400 text-xs">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
