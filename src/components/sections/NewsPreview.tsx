import Link from "next/link";
import Image from "next/image";
import { Calendar, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getLang } from "@/lib/lang";
import { t } from "@/lib/translations";

const categoryColors: Record<string, string> = {
  Prestasi: "bg-amber-100 text-amber-700",
  Pengumuman: "bg-blue-100 text-blue-700",
  Kegiatan: "bg-emerald-100 text-emerald-700",
  Beasiswa: "bg-purple-100 text-purple-700",
  PPDB: "bg-red-100 text-red-600",
  Umum: "bg-gray-100 text-gray-600",
};

export default async function NewsPreview() {
  const lang = await getLang();
  const tr = t(lang);
  let news: Awaited<ReturnType<typeof prisma.news.findMany>> = [];
  try {
    news = await prisma.news.findMany({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  } catch {
    // DB unavailable — tampilkan placeholder di bawah
  }

  const items = news.length > 0 ? news : [
    { id: "1", slug: "ppdb-2026-2027-resmi-dibuka", title: "PPDB 2026/2027 Resmi Dibuka", category: "Pengumuman", createdAt: new Date(), content: "Penerimaan Peserta Didik Baru tahun pelajaran 2026/2027 telah resmi dibuka.", thumbnail: null },
    { id: "2", slug: "ramadan-camp-1447h", title: "Ramadan Camp 1447H: Menghidupkan Malam dengan Ibadah", category: "Kegiatan", createdAt: new Date(), content: "SMK Al-Munawwir menggelar Ramadan Camp selama 10 hari penuh.", thumbnail: null },
    { id: "3", slug: "juara-1-lomba-jaringan-nasional", title: "Siswa TKJ Raih Juara 1 Lomba Jaringan Nasional", category: "Prestasi", createdAt: new Date(), content: "Tim siswa TKJ SMK Al-Munawwir meraih juara pertama tingkat nasional.", thumbnail: null },
  ];

  return (
    <section className="section-padding bg-white">
      <div className="container-custom">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
          <div>
            <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.news_label}</span>
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-navy mt-2">{tr.news_heading}</h2>
          </div>
          <Link href="/news" className="btn-primary whitespace-nowrap self-start">
            {tr.news_view_all}
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item) => (
            <article key={item.id}
              className="group rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
              <div className="h-44 bg-gradient-to-br from-primary-700 to-primary-900 relative overflow-hidden">
                {item.thumbnail ? (
                  <Image src={item.thumbnail} alt={item.title} fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
                ) : (
                  <span className="font-arabic text-white/20 text-6xl absolute inset-0 flex items-center justify-center">المنور</span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-primary-900/80 to-transparent" />
                <span className={`absolute top-4 left-4 text-xs font-semibold px-3 py-1 rounded-full ${categoryColors[item.category] ?? "bg-gray-100 text-gray-600"}`}>
                  {item.category}
                </span>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-3">
                  <Calendar size={12} />
                  <span>{new Date(item.createdAt).toLocaleDateString(tr.news_locale, { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
                <h3 className="font-heading font-bold text-navy text-base leading-snug mb-2 group-hover:text-primary-700 transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-gray-500 text-sm leading-relaxed mb-4 line-clamp-2">
                  {item.content.slice(0, 120)}...
                </p>
                <Link href={`/news/${item.slug}`}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-gold transition-colors group-hover:gap-2.5">
                  {tr.news_read_more} <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
