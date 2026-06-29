import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Calendar, Tag, ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const news = await prisma.news.findUnique({ where: { slug } });
    return { title: news?.title || "Berita", description: news?.content.slice(0, 160) };
  } catch {
    return { title: "Berita" };
  }
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let news: Awaited<ReturnType<typeof prisma.news.findUnique>> = null;
  try {
    news = await prisma.news.findUnique({ where: { slug, published: true } });
  } catch { /* DB unavailable */ }
  if (!news) notFound();

  let related: Awaited<ReturnType<typeof prisma.news.findMany>> = [];
  try {
    related = await prisma.news.findMany({
      where: { published: true, category: news.category, id: { not: news.id } },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
  } catch { /* DB unavailable */ }

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-gray-50">
        {/* Foto header */}
        <div className="relative h-72 md:h-96 w-full bg-primary-900">
          {news.thumbnail ? (
            <Image src={news.thumbnail} alt={news.title} fill sizes="100vw" className="object-cover" priority />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/80 via-primary-900/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="container-custom">
              <Link href="/news" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft size={15} /> Kembali ke Berita
              </Link>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gold text-primary-900 mb-3 inline-block">{news.category}</span>
              <h1 className="font-heading text-2xl md:text-4xl font-bold text-white leading-tight max-w-3xl">{news.title}</h1>
              <p className="text-white/60 text-sm mt-3 flex items-center gap-1.5">
                <Calendar size={13} />
                {new Date(news.createdAt).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Konten */}
        <div className="container-custom py-10">
          <div className="max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl shadow-sm border p-8 md:p-12">
              <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-wrap">
                {news.content}
              </div>
            </div>

            {/* Berita terkait */}
            {related.length > 0 && (
              <div className="mt-10">
                <h2 className="font-heading text-xl font-bold text-primary-900 mb-5">Berita Terkait</h2>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {related.map(n => (
                    <Link href={`/news/${n.slug}`} key={n.id} className="group bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                      <div className="relative h-36 bg-gray-100">
                        {n.thumbnail ? (
                          <Image src={n.thumbnail} alt={n.title} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
                            <span className="font-arabic text-white/20 text-4xl">المنور</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-sm text-primary-900 group-hover:text-gold transition-colors line-clamp-2 leading-snug">{n.title}</h3>
                        <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
