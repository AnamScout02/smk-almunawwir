"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Loader2, Newspaper, Image as ImageIcon, Clock, GalleryHorizontal } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

interface NewsRow { id: string; title: string; category: string; createdAt: string; published: boolean }
interface CategoryCount { category: string; count: number }
interface Summary {
  totalNews: number; publishedNews: number; draftNews: number; latestNews: NewsRow[];
  totalGallery: number; galleryByCategory: CategoryCount[]; daysSinceLastPublish: number | null;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function BrandingDashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/teacher/branding/summary").then(async r => {
      if (!r.ok) { const d = await r.json(); setError(d.error || "Gagal memuat data"); setLoading(false); return; }
      setData(await r.json());
      setLoading(false);
    }).catch(() => { setError("Gagal memuat data"); setLoading(false); });
  }, []);

  if (loading) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (error || !data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error || "Data tidak tersedia."}</div>;

  const isStale = data.daysSinceLastPublish !== null && data.daysSinceLastPublish > 14;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<Megaphone size={22} />}
        title="Dashboard Branding & Publikasi"
        description="Ringkasan konten berita & galeri foto website sekolah"
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/dashboard/teacher/branding/news" className="btn-gold flex items-center gap-2 text-sm">
          <Newspaper size={16} /> Kelola Berita
        </Link>
        <Link href="/dashboard/teacher/branding/gallery" className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 transition">
          <GalleryHorizontal size={16} /> Kelola Galeri
        </Link>
        <Link href="/dashboard/teacher/branding/banners" className="flex items-center gap-2 text-sm px-4 py-2 rounded-xl bg-primary-50 hover:bg-primary-100 text-primary-700 transition">
          <ImageIcon size={16} /> Kelola Banner
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-primary-500 to-primary-700 ring-1 ring-primary-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Newspaper size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Total Berita ({data.publishedNews} tayang · {data.draftNews} draf)</p>
            <p className="font-heading font-bold text-3xl text-white">{data.totalNews}</p>
          </div>
        </div>
        <div className="group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br from-purple-500 to-purple-600 ring-1 ring-purple-100">
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><ImageIcon size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Total Foto Galeri</p>
            <p className="font-heading font-bold text-3xl text-white">{data.totalGallery}</p>
          </div>
        </div>
        <div className={`group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br ${isStale ? "from-red-500 to-red-600 ring-red-100" : "from-emerald-500 to-emerald-600 ring-emerald-100"} ring-1`}>
          <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6"><Clock size={56} className="text-white" /></div>
          <div className="relative">
            <p className="text-white/70 text-xs font-medium mb-1">Hari Sejak Update Terakhir</p>
            <p className="font-heading font-bold text-3xl text-white">{data.daysSinceLastPublish ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">5 Berita Terbaru</h3>
          {data.latestNews.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada berita.</p>
          ) : (
            <div className="space-y-2">
              {data.latestNews.map(n => (
                <div key={n.id} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary-900 truncate">{n.title}</p>
                    <p className="text-gray-400 text-xs">{n.category} · {fmt(n.createdAt)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${n.published ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                    {n.published ? "Tayang" : "Draf"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-heading font-semibold text-navy text-sm mb-3">Galeri per Kategori</h3>
          {data.galleryByCategory.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Belum ada foto galeri.</p>
          ) : (
            <div className="space-y-2">
              {data.galleryByCategory.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                  <span className="text-primary-900 font-medium">{c.category}</span>
                  <span className="font-bold text-primary-700">{c.count} foto</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
