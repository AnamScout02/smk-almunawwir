import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { getSettings } from "@/lib/site-settings";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";

export default async function CTABanner() {
  const lang = await getLang();
  const tr = t(lang);
  const s = await getSettings([
    "cta.title", "cta.subtitle", "cta.ppdb_year", "cta.sub_note",
    "islamic.cta_arabic", "islamic.cta_trans", "islamic.cta_source",
  ]);

  const subtitle = s["cta.subtitle"].replace(/\d{4}\/\d{4}/, s["cta.ppdb_year"]);

  return (
    <section className="section-padding relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-900 via-primary-700 to-primary-500" />
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gold/10 rounded-full translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full -translate-x-1/3 translate-y-1/3" />

      <div className="container-custom relative">
        <div className="max-w-4xl mx-auto text-center">
          <p className="font-arabic text-gold text-3xl mb-4">{s["islamic.cta_arabic"]}</p>
          <p className="text-gold/70 text-sm mb-8">
            &ldquo;{s["islamic.cta_trans"]}&rdquo; ({s["islamic.cta_source"]})
          </p>

          <h2 className="font-heading text-3xl md:text-5xl font-bold text-white mb-4">
            {s["cta.title"]}
          </h2>
          <p className="text-white/70 text-lg mb-10 max-w-2xl mx-auto">
            {subtitle}
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10 max-w-2xl mx-auto">
            {tr.cta_benefits.map((b) => (
              <div key={b} className="flex items-center gap-2 text-sm text-white/80 bg-white/10 rounded-full px-4 py-2">
                <CheckCircle2 size={14} className="text-gold shrink-0" />
                <span className="whitespace-nowrap">{b}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/admissions" className="btn-gold text-base !px-10 !py-4 inline-flex items-center gap-2">
              {tr.cta_register}
              <ArrowRight size={18} />
            </Link>
            <Link href="/contact" className="btn-outline text-base !px-10 !py-4">
              {tr.cta_contact}
            </Link>
          </div>

          <p className="text-white/40 text-sm mt-6">
            {s["cta.sub_note"]}
          </p>
        </div>
      </div>
    </section>
  );
}
