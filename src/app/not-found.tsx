import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-cream flex items-center justify-center py-20 px-4">
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

          <h1 className="font-heading text-2xl md:text-3xl font-bold text-navy mb-3">
            Halaman Tidak Ditemukan
          </h1>
          <p className="text-gray-500 text-base mb-2 leading-relaxed">
            Maaf, halaman yang Anda cari tidak ada atau telah dipindahkan.
          </p>
          <p className="text-gray-400 text-sm italic mb-10">
            "Jangan berputus asa" — tetap semangat mencari!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 bg-primary-700 hover:bg-primary-800 text-white font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <Home size={17} />
              Kembali ke Beranda
            </Link>
            <Link
              href="/news"
              className="inline-flex items-center justify-center gap-2 bg-white border border-gray-200 hover:border-primary-300 text-navy font-semibold px-6 py-3 rounded-xl transition-colors"
            >
              <Search size={17} />
              Lihat Berita
            </Link>
          </div>

          {/* Quick links */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-xs text-gray-400 mb-4 uppercase tracking-widest font-semibold">
              Halaman Populer
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                { label: "Tentang Kami", href: "/about" },
                { label: "Program Keahlian", href: "/programs" },
                { label: "Pendaftaran", href: "/admissions" },
                { label: "Galeri", href: "/gallery" },
                { label: "Kontak", href: "/contact" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="px-4 py-1.5 bg-white border border-gray-100 rounded-full text-sm text-gray-600 hover:text-primary-700 hover:border-primary-200 transition-colors"
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
