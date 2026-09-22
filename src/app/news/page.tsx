import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Calendar, Search, Newspaper, CalendarDays } from "lucide-react";
import { getLang } from "@/lib/lang";
import { NEWS_CATEGORY_COLORS as CATEGORY_COLORS } from "@/lib/news-categories";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Berita & Kegiatan — SMK Al Munawwir IIBS",
  description: "Berita terbaru, kegiatan, dan pengumuman dari SMK Al Munawwir IIBS.",
};

const CATEGORIES = ["Semua", "Prestasi", "Pengumuman", "Kegiatan", "SPMB", "Beasiswa", "Alumni", "Umum"];
// Nilai kategori tetap bahasa Indonesia (dipakai sebagai filter & tersimpan di data berita) — hanya LABEL yang diterjemahkan.
const LABEL_KATEGORI_EN: Record<string, string> = {
  Semua: "All", Prestasi: "Achievements", Pengumuman: "Announcements", Kegiatan: "Activities",
  SPMB: "Admissions", Beasiswa: "Scholarships", Alumni: "Alumni", Umum: "General",
};
const labelKategori = (kategori: string, lang: string) => (lang === "en" ? LABEL_KATEGORI_EN[kategori] ?? kategori : kategori);

const content = {
  id: {
    label: "Informasi",
    title: "Berita & Kegiatan",
    desc: "Ikuti perkembangan terbaru SMK Al Munawwir IIBS",
    searchPh: "Cari berita...",
    emptyTitle: "Tidak ada berita ditemukan",
    showAll: "Tampilkan semua berita",
    readMore: "Baca selengkapnya →",
    locale: "id-ID",
  },
  en: {
    label: "Information",
    title: "News & Activities",
    desc: "Follow the latest updates from SMK Al Munawwir IIBS",
    searchPh: "Search news...",
    emptyTitle: "No news found",
    showAll: "Show all news",
    readMore: "Read more →",
    locale: "en-US",
  },
} as const;

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;
  const lang = await getLang();
  const c = content[lang];

  let news: Awaited<ReturnType<typeof prisma.news.findMany>> = [];
  try {
    news = await prisma.news.findMany({
      where: {
        published: true,
        ...(category && category !== "Semua" ? { category } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: { createdAt: "desc" },
    });
  } catch { /* DB unavailable */ }

  const activeCategory = category || "Semua";

  return (
    <>
      <Navbar />
      <main className="min-h-screen">
        {/* Header */}
        <section className="bg-gradient-to-br from-primary-900 to-primary-700 text-white pt-28 pb-16 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
          <div className="container-custom text-center relative">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">{c.label}</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">{c.title}</h1>
            <p className="text-white/70 text-lg">{c.desc}</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom">
            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-10">
              {/* Search */}
              <form method="GET" className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder={c.searchPh}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-primary-500"
                />
                {category && <input type="hidden" name="category" value={category} />}
              </form>

              {/* Filter kategori */}
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <Link
                    key={cat}
                    href={`/news?category=${cat}${q ? `&q=${q}` : ""}`}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      activeCategory === cat
                        ? "bg-primary-900 text-white shadow"
                        : "bg-white border text-gray-600 hover:border-primary-300 hover:text-primary-700"
                    }`}
                  >
                    {labelKategori(cat, lang)}
                  </Link>
                ))}
              </div>
            </div>

            {news.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Newspaper size={40} className="mx-auto mb-4 text-gray-300" strokeWidth={1.5} />
                <p className="text-lg font-medium">{c.emptyTitle}</p>
                <p className="text-sm mt-1">
                  <Link href="/news" className="text-primary-700 hover:underline">{c.showAll}</Link>
                </p>
              </div>
            ) : (
              <>
                {/* Berita utama */}
                <Link href={`/news/${news[0].slug}`} className="block mb-10 group">
                  <div className="bg-white rounded-3xl overflow-hidden shadow-sm border hover:shadow-lg transition-all flex flex-col lg:flex-row">
                    <div className="relative h-64 lg:h-auto lg:w-1/2 bg-gray-100 shrink-0">
                      {news[0].thumbnail ? (
                        <Image src={news[0].thumbnail} alt={news[0].title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center">
                          <span className="font-arabic text-white/20 text-8xl">المنور</span>
                        </div>
                      )}
                      <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[news[0].category] || "bg-gray-100 text-gray-600"}`}>{labelKategori(news[0].category, lang)}</span>
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                      <span className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(news[0].createdAt).toLocaleDateString(c.locale, { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      <h2 className="font-heading text-2xl md:text-3xl font-bold text-primary-900 mb-4 group-hover:text-gold transition-colors leading-tight">{news[0].title}</h2>
                      <p className="text-gray-600 leading-relaxed line-clamp-3">{news[0].content.slice(0, 250)}...</p>
                      <span className="mt-4 inline-flex items-center text-primary-700 font-semibold text-sm gap-1 group-hover:gap-2 transition-all">{c.readMore}</span>
                    </div>
                  </div>
                </Link>

                {/* Grid berita lainnya */}
                {news.length > 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {news.slice(1).map(n => (
                      <Link href={`/news/${n.slug}`} key={n.id} className="group block bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                        <div className="relative h-48 bg-gray-100">
                          {n.thumbnail ? (
                            <Image src={n.thumbnail} alt={n.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center">
                              <span className="font-arabic text-white/20 text-6xl">المنور</span>
                            </div>
                          )}
                          <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[n.category] || "bg-gray-100 text-gray-600"}`}>{labelKategori(n.category, lang)}</span>
                        </div>
                        <div className="p-5">
                          <span className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                            <CalendarDays size={11} />
                            {new Date(n.createdAt).toLocaleDateString(c.locale, { day: "numeric", month: "short", year: "numeric" })}
                          </span>
                          <h3 className="font-heading font-bold text-primary-900 leading-snug mb-2 group-hover:text-gold transition-colors line-clamp-2">{n.title}</h3>
                          <p className="text-gray-500 text-sm line-clamp-2">{n.content.slice(0, 120)}...</p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
