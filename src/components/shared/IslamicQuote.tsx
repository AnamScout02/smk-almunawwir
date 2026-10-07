import { getSettings } from "@/lib/site-settings";

export default async function IslamicQuote({ index = 0 }: { index?: number }) {
  const s = await getSettings([
    "islamic.quote1_arabic", "islamic.quote1_trans", "islamic.quote1_source",
    "islamic.quote2_arabic", "islamic.quote2_trans", "islamic.quote2_source",
    "islamic.quote3_arabic", "islamic.quote3_trans", "islamic.quote3_source",
  ]);

  const quotes = [
    { arabic: s["islamic.quote1_arabic"], translation: s["islamic.quote1_trans"], source: s["islamic.quote1_source"] },
    { arabic: s["islamic.quote2_arabic"], translation: s["islamic.quote2_trans"], source: s["islamic.quote2_source"] },
    { arabic: s["islamic.quote3_arabic"], translation: s["islamic.quote3_trans"], source: s["islamic.quote3_source"] },
  ];

  const q = quotes[index % quotes.length];

  return (
    <div className="relative rounded-2xl overflow-hidden text-center px-10 py-9"
      style={{
        background: "linear-gradient(160deg, #0F1A45 0%, #1B2B6B 50%, #0A1030 100%)",
        boxShadow: "0 8px 40px rgba(15,26,69,0.25), 0 0 0 1px rgba(232,160,32,0.2)"
      }}>
      {/* Gold accent lines */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent" />
      {/* Subtle pattern */}
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "141.42px 141.42px", backgroundRepeat: "repeat", filter: "invert(1)" }} />
      {/* Decorative gold glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: "radial-gradient(circle, rgba(232,160,32,0.6) 0%, transparent 70%)" }} />

      {/* Large quote marks */}
      <div className="absolute top-4 left-6 text-6xl leading-none select-none pointer-events-none font-serif text-gold opacity-20">❝</div>
      <div className="absolute bottom-4 right-6 text-6xl leading-none select-none pointer-events-none font-serif text-gold opacity-20">❞</div>

      {/* Content */}
      <div className="relative">
        <p className="font-arabic text-white text-2xl md:text-3xl mb-4 leading-relaxed">{q.arabic}</p>
        <p className="text-white/70 text-sm italic mb-4 leading-relaxed max-w-lg mx-auto">&ldquo;{q.translation}&rdquo;</p>
        <div className="flex items-center justify-center gap-3">
          <div className="h-px flex-1 max-w-16 bg-gradient-to-r from-transparent to-gold/60" />
          <p className="text-gold text-xs font-bold tracking-widest uppercase">{q.source}</p>
          <div className="h-px flex-1 max-w-16 bg-gradient-to-l from-transparent to-gold/60" />
        </div>
      </div>
    </div>
  );
}
