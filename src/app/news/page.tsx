import { prisma } from "@/lib/prisma";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Calendar, Search } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Berita & Kegiatan — SMK Al-Munawwir IIBS",
  description: "Berita terbaru, kegiatan, dan pengumuman dari SMK Al-Munawwir IIBS.",
};

const CATEGORY_COLORS: Record<string, string> = {
  Prestasi: "bg-amber-100 text-amber-700",
  Pengumuman: "bg-blue-100 text-blue-700",
  Kegiatan: "bg-emerald-100 text-emerald-700",
  Beasiswa: "bg-purple-100 text-purple-700",
  PPDB: "bg-red-100 text-red-700",
  Alumni: "bg-teal-100 text-teal-700",
  Umum: "bg-gray-100 text-gray-600",
};

const CATEGORIES = ["Semua", "Prestasi", "Pengumuman", "Kegiatan", "PPDB", "Beasiswa", "Alumni", "Umum"];

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;

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
        <section className="bg-gradient-to-br from-primary-900 via-primary-700 to-primary-600 text-white pt-28 pb-16">
          <div className="container-custom text-center">
            <span className="text-gold text-sm font-semibold uppercase tracking-widest">Informasi</span>
            <h1 className="font-heading text-4xl md:text-5xl font-bold mt-2 mb-4">Berita & Kegiatan</h1>
            <p className="text-white/70 text-lg">Ikuti perkembangan terbaru SMK Al-Munawwir IIBS</p>
          </div>
        </section>

        <section className="section-padding bg-cream">
          <div className="container-custom">
            {/* Search & Filter */}
            <div className="flex flex-col md:flex-row gap-4 mb-10">
              {/* Search */}
              <form method="GET" className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Cari berita..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:border-primary-400"
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
                    {cat}
                  </Link>
                ))}
              </div>
            </div>

            {news.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-4xl mb-4">📰</p>
                <p className="text-lg font-medium">Tidak ada berita ditemukan</p>
                <p className="text-sm mt-1">
                  <Link href="/news" className="text-primary-600 hover:underline">Tampilkan semua berita</Link>
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
                        <div className="w-full h-full bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
                          <span className="font-arabic text-white/20 text-8xl">المنور</span>
                        </div>
                      )}
                      <span className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold ${CATEGORY_COLORS[news[0].category] || "bg-gray-100 text-gray-600"}`}>{news[0].category}</span>
                    </div>
                    <div className="p-8 flex flex-col justify-center">
                      <span className="text-xs text-gray-400 mb-3 flex items-center gap-1.5">
                        <Calendar size={12} />
                        {new Date(news[0].createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                      <h2 className="font-heading text-2xl md:text-3xl font-bold text-primary-900 mb-4 group-hover:text-gold transition-colors leading-tight">{news[0].title}</h2>
                      <p className="text-gray-600 leading-relaxed line-clamp-3">{news[0].content.slice(0, 250)}...</p>
                      <span className="mt-4 inline-flex items-center text-primary-700 font-semibold text-sm gap-1 group-hover:gap-2 transition-all">Baca selengkapnya →</span>
                    </div>
                  </div>
                </Link>

                {/* Grid berita lainnya */}
                {news.length > 1 && (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {news.slice(1).map(n => (
                      <Link href={`/news/${n.slug}`} key={n.id} className="group bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                        <div className="relative h-48 bg-gray-100">
                          {n.thumbnail ? (
                            <Image src={n.thumbnail} alt={n.title} fill sizes="(max-width: 640px) 100vw, 33vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
                              <span className="font-arabic text-white/20 text-6xl">المنور</span>
                            </div>
                          )}
                          <span className={`absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-xs font-semibold ${CATEGORY_COLORS[n.category] || "bg-gray-100 text-gray-600"}`}>{n.category}</span>
                        </div>
                        <div className="p-5">
                          <span className="text-xs text-gray-400 flex items-center gap-1 mb-2">
                            <Calendar size={11} />
                            {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
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
