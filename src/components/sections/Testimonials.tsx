"use client";
import { useState } from "react";
import Image from "next/image";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/lib/translations";
import type { Lang } from "@/lib/lang";
import TeksGerak from "@/components/gerak/TeksGerak";

/** TESTIMONI BERANDA (4 Okt 2026) — dari Konten Halaman → "Testimoni (Beranda)" (`beranda.testimoni`, JSON), bukan
 *  lagi daftar tertulis mati di kode yang nama-namanya contoh. Kosong = bagian ini TIDAK tampil sama sekali: situs
 *  resmi sekolah tidak boleh memajang testimoni karangan. Isi hanya bahasa Indonesia (CLAUDE.md #41). */
export type { Testimoni } from "@/lib/testimoni";
import type { Testimoni } from "@/lib/testimoni";

export default function Testimonials({ lang = "id", data = [] }: { lang?: Lang; data?: Testimoni[] }) {
  const [current, setCurrent] = useState(0);
  const tr = t(lang);
  const testimonials = data.filter(x => x.nama.trim() && x.isi.trim());
  if (!testimonials.length) return null;

  const prev = () => setCurrent((c) => (c === 0 ? testimonials.length - 1 : c - 1));
  const next = () => setCurrent((c) => (c + 1) % testimonials.length);

  const item = testimonials[current];

  return (
    <section className="section-padding bg-primary-900 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.08] pointer-events-none"
        style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "254.56px 254.56px", backgroundRepeat: "repeat", filter: "invert(1)" }}
      />

      <div className="container-custom relative">
        <div className="text-center mb-12">
          <span className="text-gold font-semibold text-sm uppercase tracking-widest">{tr.testimonials_label}</span>
          <h2 className="gerak-judul font-heading text-3xl md:text-4xl font-bold text-white mt-2">
            <TeksGerak teks={tr.testimonials_heading} />
          </h2>
        </div>

        <div className="gerak-naik max-w-3xl mx-auto">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-3xl p-8 md:p-12 text-center">
            <Quote size={40} className="text-gold/40 mx-auto mb-6" />

            <p key={`isi-${current}`} className="spmb-muncul text-white/90 text-lg md:text-xl leading-relaxed mb-8 italic">
              &ldquo;{item.isi}&rdquo;
            </p>

            <div className="flex flex-col items-center gap-3">
              {item.foto && (
                <span className="relative h-16 w-16 overflow-hidden rounded-full ring-2 ring-gold/60">
                  <Image src={item.foto} alt={item.nama} fill sizes="64px" className="object-cover" />
                </span>
              )}
              <div>
                <div className="font-heading font-bold text-white text-lg">{item.nama}</div>
                {item.peran && <div className="text-gold/80 text-sm mt-1">{item.peran}</div>}
              </div>
            </div>
          </div>

          {testimonials.length > 1 && <div className="flex items-center justify-center gap-4 mt-8">
            <button onClick={prev}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 hover:border-gold transition">
              <ChevronLeft size={20} />
            </button>

            <div className="flex gap-2">
              {testimonials.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === current ? "w-8 bg-gold" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>

            <button onClick={next}
              className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white hover:bg-white/10 hover:border-gold transition">
              <ChevronRight size={20} />
            </button>
          </div>}
        </div>
      </div>
    </section>
  );
}
