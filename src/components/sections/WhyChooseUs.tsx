import { Building2, BookOpenCheck, GraduationCap, Briefcase, Wrench, Moon } from "lucide-react";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";

const items = [
  { icon: Building2, titleKey: "why_1_title", descKey: "why_1_desc", accent: "from-primary-600 to-primary-800" },
  { icon: BookOpenCheck, titleKey: "why_2_title", descKey: "why_2_desc", accent: "from-gold to-gold-dark" },
  { icon: GraduationCap, titleKey: "why_3_title", descKey: "why_3_desc", accent: "from-emerald-500 to-emerald-700" },
  { icon: Briefcase, titleKey: "why_4_title", descKey: "why_4_desc", accent: "from-blue-500 to-blue-700" },
  { icon: Wrench, titleKey: "why_5_title", descKey: "why_5_desc", accent: "from-purple-500 to-purple-700" },
  { icon: Moon, titleKey: "why_6_title", descKey: "why_6_desc", accent: "from-primary-700 to-primary-900" },
] as const;

export default async function WhyChooseUs() {
  const lang = await getLang();
  const tr = t(lang);
  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.why_label}</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-navy mt-2">{tr.why_heading}</h2>
          <p className="text-gray-500 mt-3">{tr.why_sub}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, titleKey, descKey, accent }) => (
            <div key={titleKey}
              className="group bg-cream rounded-2xl p-6 border border-gray-100 hover:border-gold/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={22} />
              </div>
              <h3 className="font-heading font-bold text-navy text-lg mb-2">{tr[titleKey]}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{tr[descKey]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
