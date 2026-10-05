import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { transisiBerita } from "@/lib/nama-transisi";
import TombolBagikan from "@/components/shared/TombolBagikan";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Calendar, Tag, ArrowLeft } from "lucide-react";
import { getLang } from "@/lib/lang";
import { ALAMAT_APLIKASI } from "@/lib/alamat-aplikasi";

export const dynamic = "force-dynamic";

const content = {
  id: { back: "Kembali ke Berita", related: "Berita Terkait", locale: "id-ID" },
  en: { back: "Back to News", related: "Related News", locale: "en-US" },
} as const;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    const news = await prisma.news.findUnique({ where: { slug } });
    if (!news) return { title: "Berita" };
    // Gambar pratinjau saat tautan dibagikan ke WhatsApp/medsos (17 Sep 2026) — alamat mutlak, wajib.
    const gambar = news.thumbnail ? `${ALAMAT_APLIKASI}${news.thumbnail}` : `${ALAMAT_APLIKASI}/images/logo-full.png`;
    const ringkas = news.content.replace(/\s+/g, " ").slice(0, 160);
    return {
      title: news.title, description: ringkas,
      openGraph: { title: news.title, description: ringkas, type: "article", locale: "id_ID", images: [{ url: gambar }] },
      twitter: { card: "summary_large_image", title: news.title, description: ringkas, images: [gambar] },
    };
  } catch {
    return { title: "Berita" };
  }
}

export default async function NewsDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const lang = await getLang();
  const c = content[lang];
  let news: Awaited<ReturnType<typeof prisma.news.findUnique>> = null;
  try {
    news = await prisma.news.findUnique({ where: { slug, published: true } });
  } catch { /* DB unavailable */ }
  if (!news) notFound();
  // Jumlah pembaca (tanpa memblokir render). Permintaan PRA-MUAT (Speculation Rules, header
  // Sec-Purpose: prefetch / prefetch;prerender) bukan pembaca — tanpa ini angka baca menggelembung.
  const tujuan = (await headers()).get("sec-purpose") ?? "";
  if (!/prefetch|prerender/i.test(tujuan)) {
    prisma.news.update({ where: { id: news.id }, data: { views: { increment: 1 } } }).catch(() => null);
  }

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
      <main className="min-h-dvh bg-gray-50" style={{ backgroundImage: "repeating-linear-gradient(45deg, rgba(15,26,69,0.07) 0px, rgba(15,26,69,0.07) 1px, transparent 1px, transparent 18px)" }}>
        {/* Foto header */}
        {/* Bilah kemajuan membaca — CSS scroll-driven animation, tanpa JavaScript (globals.css .bilah-baca). */}
        <div className="bilah-baca" aria-hidden />
        <div className="relative h-72 md:h-96 w-full overflow-hidden bg-primary-900" style={{ viewTransitionName: transisiBerita(news.slug) }}>
          {news.thumbnail ? (
            <Image src={news.thumbnail} alt={news.title} fill sizes="100vw" className="object-cover" priority />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-primary-900/80 via-primary-900/40 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
            <div className="container-custom">
              <Link href="/news" className="inline-flex items-center gap-1.5 text-white/70 hover:text-white text-sm mb-4 transition-colors">
                <ArrowLeft size={15} /> {c.back}
              </Link>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gold text-primary-900 mb-3 inline-block">{news.category}</span>
              <h1 className="font-heading text-2xl md:text-4xl font-bold text-white leading-tight max-w-3xl">{news.title}</h1>
              <p className="text-white/60 text-sm mt-3 flex items-center gap-1.5">
                <Calendar size={13} />
                {new Date(news.createdAt).toLocaleDateString(c.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" })}
              </p>
              <TombolBagikan judul={news.title} label={lang === "id" ? "Bagikan" : "Share"}
                className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20" />
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
                <h2 className="font-heading text-xl font-bold text-primary-900 mb-5">{c.related}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {related.map(n => (
                    <a href={`/news/${n.slug}`} key={n.id} className="group block bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
                      <div className="relative h-36 bg-gray-100 overflow-hidden" style={{ viewTransitionName: transisiBerita(n.slug) }}>
                        {n.thumbnail ? (
                          <Image src={n.thumbnail} alt={n.title} fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center">
                            <span className="font-arabic text-white/20 text-4xl">المنور</span>
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-sm text-primary-900 group-hover:text-gold transition-colors line-clamp-2 leading-snug">{n.title}</h3>
                        <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleDateString(c.locale, { day: "numeric", month: "short", year: "numeric" })}</p>
                      </div>
                    </a>
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
