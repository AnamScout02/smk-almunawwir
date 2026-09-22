import { Building2, BookOpenCheck, GraduationCap, Briefcase, Wrench, Moon } from "lucide-react";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";
import { getSettings } from "@/lib/site-settings";

const items = [
  { icon: Building2, n: 1, accent: "from-primary-500 to-primary-900" },
  { icon: BookOpenCheck, n: 2, accent: "from-gold to-gold-dark" },
  { icon: GraduationCap, n: 3, accent: "from-emerald-500 to-emerald-700" },
  { icon: Briefcase, n: 4, accent: "from-blue-500 to-blue-700" },
  { icon: Wrench, n: 5, accent: "from-purple-500 to-purple-700" },
  { icon: Moon, n: 6, accent: "from-primary-700 to-primary-900" },
] as const;

const KUNCI = ["why.label", "why.heading", "why.sub", ...items.flatMap(({ n }) => [`why.${n}_title`, `why.${n}_desc`])];

/** KEUNGGULAN KAMI (beranda). Bahasa Indonesia diambil dari Konten Halaman → "Keunggulan (Beranda)" supaya bisa diubah
 * admin tanpa mengubah kode; bahasa Inggris memakai terjemahan bawaan (src/lib/translations.ts). */
export default async function WhyChooseUs() {
  const lang = await getLang();
  const tr = t(lang);
  const s = lang === "id" ? await getSettings(KUNCI) : null;
  const teks = (kunci: string, cadangan: string) => (s?.[kunci]?.trim() ? s[kunci] : cadangan);
  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-gold font-semibold text-sm uppercase tracking-widest">{teks("why.label", tr.why_label)}</span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-navy mt-2">{teks("why.heading", tr.why_heading)}</h2>
          <p className="text-gray-500 mt-3">{teks("why.sub", tr.why_sub)}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(({ icon: Icon, n, accent }) => (
            <div key={n}
              className="group bg-cream rounded-2xl p-6 border border-gray-100 hover:border-gold/30 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${accent} text-white flex items-center justify-center mb-4 shadow-md group-hover:scale-110 transition-transform duration-300`}>
                <Icon size={22} />
              </div>
              <h3 className="font-heading font-bold text-navy text-lg mb-2">{teks(`why.${n}_title`, tr[`why_${n}_title`])}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{teks(`why.${n}_desc`, tr[`why_${n}_desc`])}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
