"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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

const defaultSlidesEn: Banner[] = [
  { id: "1", title: "Nurturing a Qur'anic & Skilled Generation", subtitle: "Combining the national vocational curriculum with intensive Islamic education — preparing a generation of noble character, ready for the global workplace.", linkUrl: "/admissions", linkText: "Register Now" },
  { id: "2", title: "An International-Class Boarding School", subtitle: "A conducive modern pesantren environment, complete facilities, and 24-hour character development shape outstanding individuals.", linkUrl: "/about", linkText: "Learn More" },
  { id: "3", title: "Qur'an Memorization & Modern Technology", subtitle: "An integrated tahfidz program with technical skills — our graduates memorize the Qur'an while mastering the technology of the future.", linkUrl: "/programs", linkText: "View Programs" },
];

interface HeroStats {
  students?: string;
  majors?: string;
  foundedYear?: string;
  graduationRate?: string;
}

/** `slideUtama`: judul & paragraf slide pertama dari Konten Halaman (school.tagline / school.hero_subtitle) — dipakai
 * selama belum ada slide di menu Banner/Hero. */
export default function Hero({ lang = "id", stats, slideUtama }: { lang?: Lang; stats?: HeroStats; slideUtama?: { title: string; subtitle: string } }) {
  const tr = t(lang);
  // Slide bawaan DIHITUNG tiap render dari `lang` (bukan disimpan di state awal): saat bahasa diganti lewat navbar,
  // halaman hanya di-refresh (komponen tidak dipasang ulang) — state awal akan membeku di bahasa lama.
  const [banner, setBanner] = useState<Banner[] | null>(null);
  const dasar = lang === "en" ? defaultSlidesEn : defaultSlides;
  const slides = banner ?? (slideUtama
    ? [{ ...dasar[0], title: slideUtama.title || dasar[0].title, subtitle: slideUtama.subtitle || dasar[0].subtitle }, ...dasar.slice(1)]
    : dasar);
  const [current, setCurrent] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/banners")
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setBanner(data); })
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
    <section className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden">
      {/* Background: foto jika ada, gradien animasi jika tidak */}
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
          <div className="absolute inset-0 bg-primary-900/70" />
        </>
      ) : (
        <div className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #080e25 0%, #0F1A45 25%, #1B2B6B 55%, #0a1535 80%, #0F1A45 100%)",
            backgroundSize: "400% 400%",
            animation: "gradientShift 14s ease infinite",
          }}
        />
      )}

      {/* Gradasi kedua bergerak (lapisan kedua, arah & warna berbeda untuk kedalaman) */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: "linear-gradient(200deg, transparent 10%, rgba(59,91,219,0.18) 35%, transparent 55%, rgba(232,160,32,0.10) 75%, transparent 95%)",
          backgroundSize: "300% 300%",
          animation: "gradientShift 22s ease infinite reverse",
        }}
      />

      {/* Pattern overlay */}
      <div className="absolute inset-0 opacity-[0.06] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "254.56px 254.56px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />

      {/* Animated gradient orbs */}
      <div className="absolute pointer-events-none overflow-hidden inset-0">
        <div className="absolute top-10 right-[15%] w-96 h-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 70%)", animation: "float 10s ease-in-out infinite" }} />
        <div className="absolute bottom-20 left-[10%] w-80 h-80 rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #3b5bdb 0%, transparent 70%)", animation: "float 14s ease-in-out infinite reverse" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 blur-3xl"
          style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 60%)", animation: "gradientShift 20s ease infinite" }} />
      </div>

      {/* Dekorasi cincin emas animasi */}
      <div className="absolute top-20 right-10 w-80 h-80 rounded-full border border-gold/20 pointer-events-none"
        style={{ animation: "floatRing 8s ease-in-out infinite" }} />
      <div className="absolute top-20 right-10 w-72 h-72 rounded-full border-2 border-gold/10 pointer-events-none"
        style={{ animation: "floatRing 8s ease-in-out infinite", animationDelay: "0.5s" }} />
      <div className="absolute bottom-20 left-10 w-52 h-52 rounded-full border border-gold/15 pointer-events-none"
        style={{ animation: "floatRing 11s ease-in-out infinite reverse" }} />
      <div className="absolute bottom-32 left-20 w-36 h-36 rounded-full border border-white/8 pointer-events-none"
        style={{ animation: "floatRing 9s ease-in-out infinite" }} />

      {/* Floating particles (lebih banyak & lebih vivid) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        {([
          { size: 4,  left: "4%",   delay: "0s",     dur: "7s",  gold: false },
          { size: 6,  left: "10%",  delay: "1.2s",   dur: "16s", gold: true  },
          { size: 3,  left: "16%",  delay: "2.5s",   dur: "9s",  gold: false },
          { size: 7,  left: "22%",  delay: "0.4s",   dur: "20s", gold: true  },
          { size: 4,  left: "28%",  delay: "3.2s",   dur: "6s",  gold: false },
          { size: 5,  left: "34%",  delay: "1.8s",   dur: "13s", gold: true  },
          { size: 3,  left: "40%",  delay: "2.8s",   dur: "8s",  gold: false },
          { size: 8,  left: "46%",  delay: "0.2s",   dur: "18s", gold: true  },
          { size: 4,  left: "52%",  delay: "4s",     dur: "10s", gold: false },
          { size: 6,  left: "58%",  delay: "1.1s",   dur: "15s", gold: true  },
          { size: 3,  left: "64%",  delay: "3.5s",   dur: "7s",  gold: false },
          { size: 7,  left: "70%",  delay: "0.8s",   dur: "19s", gold: true  },
          { size: 4,  left: "76%",  delay: "4.6s",   dur: "11s", gold: false },
          { size: 5,  left: "82%",  delay: "0.6s",   dur: "14s", gold: true  },
          { size: 3,  left: "88%",  delay: "2.2s",   dur: "6.5s",gold: false },
          { size: 6,  left: "94%",  delay: "1.4s",   dur: "17s", gold: true  },
          { size: 4,  left: "13%",  delay: "5s",     dur: "9.5s",gold: false },
          { size: 5,  left: "19%",  delay: "3.8s",   dur: "12s", gold: true  },
          { size: 3,  left: "37%",  delay: "5.5s",   dur: "8.5s",gold: false },
          { size: 7,  left: "61%",  delay: "2s",     dur: "21s", gold: true  },
          { size: 4,  left: "85%",  delay: "4.3s",   dur: "10.5s",gold: false },
          { size: 6,  left: "97%",  delay: "0.3s",   dur: "16.5s",gold: true  },
        ] as const).map((p, i) => (
          <div key={i}
            className="absolute bottom-0 rounded-full"
            style={{
              width:  `${p.size}px`,
              height: `${p.size}px`,
              left:   p.left,
              background: p.gold
                ? `rgba(232,160,32,${0.4 + (i % 3) * 0.15})`
                : `rgba(255,255,255,${0.15 + (i % 4) * 0.1})`,
              boxShadow: p.gold ? `0 0 ${p.size * 2}px rgba(232,160,32,0.6)` : "none",
              animation: `floatParticle ${p.dur} ease-in ${p.delay} infinite`,
            }}
          />
        ))}
      </div>

      {/* Konten */}
      <div className="relative z-10 container-custom text-center pt-24 pb-16 px-4">
        {/* Tagline badge */}
        <div className="inline-flex items-center gap-2.5 bg-white/8 backdrop-blur-sm border border-gold/25 rounded-full pl-4 pr-5 py-2 mb-8">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-gold" />
          </span>
          <span className="text-gold text-sm font-semibold tracking-wide">{tr.hero_badge}</span>
        </div>

        {/* Judul slide */}
        <div className="min-h-[100px] md:min-h-[80px] flex flex-col items-center justify-center mb-6">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-heading font-bold text-white leading-tight">
            <span
              style={{
                background: "linear-gradient(90deg, #E8A020 0%, #F5C842 25%, #FFF4D6 50%, #F5C842 75%, #E8A020 100%)",
                backgroundSize: "200% auto",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                animation: "shimmer 5s linear infinite",
              }}
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
            { v: stats?.students ? `${stats.students}+` : "1.200+", l: tr.hero_active_students },
            { v: stats?.foundedYear || "2014", l: tr.hero_founded },
            { v: stats?.majors || "5", l: tr.hero_majors },
            // Tingkat kelulusan hanya tampil bila admin mengisinya — tidak ada angka bawaan.
            ...(stats?.graduationRate ? [{ v: `${stats.graduationRate}%`, l: tr.hero_graduation }] : []),
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
