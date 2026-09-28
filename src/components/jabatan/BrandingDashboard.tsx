"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Loader2, Newspaper, Image as ImageIcon, Clock, GalleryHorizontal, Camera } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface NewsRow { id: string; title: string; category: string; createdAt: string; published: boolean }
interface CategoryCount { category: string; count: number }
interface Summary {
  totalNews: number; publishedNews: number; draftNews: number; latestNews: NewsRow[];
  totalGallery: number; galleryByCategory: CategoryCount[]; daysSinceLastPublish: number | null;
}

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
export default function BrandingDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
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

  /* BARIS PINTASAN (27 September 2026) — mengikuti pola Dashboard Kurikulum: empat halaman yang paling sering
     dibuka SETELAH melihat dashboard ini. Bukan daftar semua menu; empat yang benar-benar jadi langkah berikutnya. */
  const pintasan = [
    { href: tautanJabatan(basePath, "branding/news"), label: "Berita Sekolah", ikon: Newspaper },
    { href: tautanJabatan(basePath, "branding/gallery"), label: "Galeri Foto", ikon: GalleryHorizontal },
    { href: tautanJabatan(basePath, "branding/banners"), label: "Banner Beranda", ikon: ImageIcon },
    { href: tautanJabatan(basePath, "branding/liputan"), label: "Liputan Media", ikon: Camera },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Megaphone size={22} />}
        title="Dashboard Branding & Publikasi"
        description="Ringkasan konten berita & galeri foto website sekolah"
      />

      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile color="primary" icon={Newspaper} value={data.totalNews}
            label={`Total Berita (${data.publishedNews} tayang · ${data.draftNews} draf)`} />
          <StatTile color="purple" icon={ImageIcon} label="Total Foto Galeri" value={data.totalGallery} />
          <StatTile color={isStale ? "red" : "emerald"} icon={Clock} label="Hari Sejak Update Terakhir"
            value={data.daysSinceLastPublish ?? "—"} />
        </div>
        <BarisPintasan items={pintasan} />


        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-navy text-sm mb-3">5 Berita Terbaru</h3>
            {data.latestNews.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Belum ada berita.</p>
            ) : (
              <div className="space-y-2">
                {data.latestNews.map(n => (
                  <div key={n.id} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-primary-900 truncate">{n.title}</p>
                      <p className="text-gray-400 text-xs">{n.category} · {fmt(n.createdAt)}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap ml-2 ${n.published ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-500 border border-gray-200"}`}>
                      {n.published ? "Tayang" : "Draf"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-navy text-sm mb-3">Galeri per Kategori</h3>
            {data.galleryByCategory.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Belum ada foto galeri.</p>
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
    </div>
  );
}
