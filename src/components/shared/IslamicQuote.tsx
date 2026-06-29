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
    <div className="bg-primary-50 border border-primary-100 rounded-2xl p-6 text-center">
      <div className="w-8 h-0.5 bg-gold mx-auto mb-4" />
      <p className="font-arabic text-primary-800 text-2xl leading-relaxed mb-3">{q.arabic}</p>
      <p className="text-primary-600 text-sm italic mb-1">&ldquo;{q.translation}&rdquo;</p>
      <p className="text-gold text-xs font-semibold">{q.source}</p>
      <div className="w-8 h-0.5 bg-gold mx-auto mt-4" />
    </div>
  );
}
