import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Home, Search } from "lucide-react";
import { getLang } from "@/lib/lang";

export const dynamic = "force-dynamic";

const TEKS = {
  id: {
    judul: "Halaman Tidak Ditemukan", isi: "Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.",
    kutipan: "\"Jangan berputus asa\" — tetap semangat mencari!", beranda: "Kembali ke Beranda", berita: "Lihat Berita", populer: "Halaman Populer",
    tautan: [
      { label: "Tentang Kami", href: "/about" }, { label: "Program Keahlian", href: "/programs" }, { label: "Pendaftaran", href: "/admissions" },
      { label: "Galeri", href: "/gallery" }, { label: "Kontak", href: "/contact" },
    ],
  },
  en: {
    judul: "Page Not Found", isi: "Sorry, the page you are looking for does not exist or has been moved.",
    kutipan: "\"Do not despair\" — keep searching!", beranda: "Back to Home", berita: "See News", populer: "Popular Pages",
    tautan: [
      { label: "About Us", href: "/about" }, { label: "Study Programs", href: "/programs" }, { label: "Admissions", href: "/admissions" },
      { label: "Gallery", href: "/gallery" }, { label: "Contact", href: "/contact" },
    ],
  },
};

export default async function NotFound() {
  const c = TEKS[await getLang()];
  return (
    <>
      <Navbar />
      <main className="min-h-dvh bg-cream flex items-center justify-center py-20 px-4">
        <div className="text-center max-w-lg mx-auto">
          {/* Angka 404 dekoratif */}
          <div className="relative mb-8 select-none">
            <p className="font-heading text-[10rem] md:text-[12rem] font-bold leading-none text-primary-100">
              404
            </p>
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="font-arabic text-gold text-4xl md:text-5xl">
                لَا تَيْأَسُوا
              </p>
            </div>
          </div>

          <h1 className="font-heading text-2xl md:text-3xl font-bold text-navy mb-3">{c.judul}</h1>
          <p className="text-gray-500 text-base mb-2 leading-relaxed">{c.isi}</p>
          <p className="text-gray-400 text-sm italic mb-10">{c.kutipan}</p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="btn-primary"
            >
              <Home size={17} />
              {c.beranda}
            </Link>
            <Link
              href="/news"
              className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-primary-300 text-navy font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <Search size={17} />
              {c.berita}
            </Link>
          </div>

          {/* Quick links */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-4 uppercase tracking-widest font-semibold">{c.populer}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {c.tautan.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-4 py-1.5 bg-white border border-gray-100 rounded-full text-sm text-gray-600 hover:text-primary-700 hover:border-primary-100 transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
