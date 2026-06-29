import Link from "next/link";
import { Network, Calculator, Leaf, Palette, Building2, ArrowRight } from "lucide-react";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";

const programsData = [
  {
    icon: Network,
    code: "TKJ",
    name: "Teknik Komputer & Jaringan",
    nameEn: "Computer & Network Engineering",
    descKey: "prog_tkj_desc" as const,
    color: "from-blue-500 to-blue-700",
    features: ["Networking", "Cybersecurity", "Cloud Computing", "Server Admin"],
  },
  {
    icon: Calculator,
    code: "AK",
    name: "Akuntansi",
    nameEn: "Accounting",
    descKey: "prog_ak_desc" as const,
    color: "from-orange-500 to-orange-700",
    features: ["Akuntansi / Accounting", "Perpajakan / Taxation", "MYOB/Zahir", "Laporan Keuangan"],
  },
  {
    icon: Leaf,
    code: "ATU",
    name: "Agribisnis Ternak Unggas",
    nameEn: "Poultry Agribusiness",
    descKey: "prog_atu_desc" as const,
    color: "from-emerald-500 to-emerald-700",
    features: ["Farm Management", "Animal Nutrition", "Animal Health", "Agribusiness"],
  },
  {
    icon: Palette,
    code: "DKV",
    name: "Desain Komunikasi Visual",
    nameEn: "Visual Communication Design",
    descKey: "prog_dkv_desc" as const,
    color: "from-purple-500 to-purple-700",
    features: ["Graphic Design", "Branding", "Motion Graphics", "Digital Content"],
  },
  {
    icon: Building2,
    code: "DPIB",
    name: "Desain Pemodelan & Informasi Bangunan",
    nameEn: "Building Modeling & Information Design",
    descKey: "prog_dpib_desc" as const,
    color: "from-teal-500 to-teal-700",
    features: ["AutoCAD", "SketchUp", "BIM/Revit", "Cost Estimation"],
  },
];

export default async function Programs() {
  const lang = await getLang();
  const tr = t(lang);
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
          {programsData.map((p) => (
            <div key={p.code}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className={`h-1.5 bg-gradient-to-r ${p.color}`} />
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl bg-gradient-to-br ${p.color} text-white shrink-0`}>
                    <p.icon size={22} />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{p.code}</span>
                    <h3 className="font-heading font-bold text-navy text-base leading-tight">
                      {lang === "en" ? p.nameEn : p.name}
                    </h3>
                  </div>
                </div>
                <p className="text-gray-500 text-sm mb-5 leading-relaxed">{tr[p.descKey]}</p>
                <div className="flex flex-wrap gap-2 mb-5">
                  {p.features.map((f) => (
                    <span key={f} className="text-xs bg-primary-50 text-primary-700 px-2.5 py-1 rounded-full font-medium">{f}</span>
                  ))}
                </div>
                <Link href={`/programs/${p.code.toLowerCase()}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-gold transition-colors group-hover:gap-2.5">
                  {tr.programs_explore} <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          ))}

          {/* Islamic programs card */}
          <div className="bg-gradient-to-br from-primary-700 to-primary-900 rounded-2xl p-6 text-white">
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
    </section>
  );
}
