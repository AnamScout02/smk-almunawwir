"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, Star } from "lucide-react";
import { t } from "@/lib/translations";
import type { Lang } from "@/lib/lang";

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  linkUrl?: string;
  linkText?: string;
}

const defaultSlides: Banner[] = [
  { id: "1", title: "Mendidik Generasi Qurani & Terampil", subtitle: "Memadukan kurikulum vokasional nasional dengan pendidikan Islam intensif — menyiapkan generasi yang berakhlak mulia dan siap menghadapi dunia kerja global.", linkUrl: "/admissions", linkText: "Daftar Sekarang" },
  { id: "2", title: "Boarding School Berkelas Internasional", subtitle: "Lingkungan pesantren modern yang kondusif, fasilitas lengkap, dan pembinaan karakter 24 jam membentuk pribadi unggul.", linkUrl: "/about", linkText: "Pelajari Lebih Lanjut" },
  { id: "3", title: "Tahfidz Al-Qur'an & Teknologi Modern", subtitle: "Program tahfidz terintegrasi dengan keahlian teknis — lulusan kami hafal Al-Qur'an sekaligus menguasai teknologi masa depan.", linkUrl: "/programs", linkText: "Lihat Program" },
];

export default function Hero({ lang = "id" }: { lang?: Lang }) {
  const tr = t(lang);
  const [slides, setSlides] = useState<Banner[]>(defaultSlides);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/banners")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setSlides(data); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);

  const slide = slides[current];
  const prev = () => setCurrent(c => (c - 1 + slides.length) % slides.length);
  const next = () => setCurrent(c => (c + 1) % slides.length);

  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Background: foto jika ada, gradien jika tidak */}
      {slide.imageUrl ? (
        <>
          <Image
            key={slide.id}
            src={slide.imageUrl}
            alt={slide.title}
            fill
            priority
            sizes="100vw"
            className="object-cover transition-opacity duration-700"
          />
          <div className="absolute inset-0 bg-primary-900/65" />
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900 via-primary-700 to-primary-500" />
          <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
            style={{ backgroundImage: "url('/images/pattern-smk.png')", backgroundSize: "180px 180px", backgroundRepeat: "repeat", filter: "invert(1)" }}
          />
        </>
      )}

      {/* Dekorasi cincin emas */}
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full border-8 border-gold/15 opacity-50 pointer-events-none" />
      <div className="absolute bottom-20 left-10 w-48 h-48 rounded-full border-4 border-gold/10 opacity-40 pointer-events-none" />

      {/* Konten */}
      <div className="relative z-10 container-custom text-center pt-24 pb-16 px-4">
        {/* Tagline badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-gold/30 rounded-full px-6 py-2 mb-8">
          <Star size={14} className="text-gold" />
          <span className="text-gold text-sm font-semibold tracking-wide">Integrated and Character Education</span>
          <Star size={14} className="text-gold" />
        </div>

        {/* Judul slide */}
        <div className="min-h-[100px] md:min-h-[80px] flex flex-col items-center justify-center mb-6">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold text-white leading-tight">
            <span
              style={{ background: "linear-gradient(135deg, #E8A020, #F5C842)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            >
              {slide.title}
            </span>
          </h1>
        </div>

        <p className="text-white/80 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
          {slide.subtitle}
        </p>

        {/* Tombol CTA */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
          {slide.linkUrl && (
            <Link href={slide.linkUrl} className="btn-gold text-base !px-8 !py-4">
              {slide.linkText || "Selengkapnya"}
            </Link>
          )}
          <Link href="/about" className="btn-outline text-base !px-8 !py-4">
            {tr.hero_about}
          </Link>
        </div>

        {/* Statistik mini */}
        <div className="flex flex-wrap justify-center gap-8 mb-12">
          {[
            { v: "1.200+", l: tr.hero_active_students },
            { v: "2014", l: tr.hero_founded },
            { v: "5", l: tr.hero_majors },
            { v: "98%", l: tr.hero_graduation },
          ].map(s => (
            <div key={s.l} className="text-center">
              <div className="text-2xl font-heading font-bold text-gold">{s.v}</div>
              <div className="text-white/60 text-sm">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Navigasi slide */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-4">
            <button onClick={prev} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2">
              {slides.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)} className={`h-1.5 rounded-full transition-all duration-300 ${i === current ? "w-8 bg-gold" : "w-4 bg-white/30"}`} />
              ))}
            </div>
            <button onClick={next} className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <ChevronDown size={28} className="text-white/50" />
      </div>
    </section>
  );
}
