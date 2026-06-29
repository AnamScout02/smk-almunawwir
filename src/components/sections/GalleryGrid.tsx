"use client";
import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";

interface GalleryItem {
  id: string;
  title: string;
  imageUrl: string;
  category: string;
  caption?: string | null;
}

export default function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const categories = ["Semua", ...Array.from(new Set(items.map(i => i.category)))];
  const [activeCategory, setActiveCategory] = useState("Semua");
  const [lightbox, setLightbox] = useState<GalleryItem | null>(null);

  const filtered = activeCategory === "Semua" ? items : items.filter(i => i.category === activeCategory);

  return (
    <section className="section-padding bg-cream">
      <div className="container-custom">
        {/* Filter kategori */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-primary-900 text-white shadow"
                  : "bg-white border text-gray-600 hover:border-primary-300 hover:text-primary-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-4">🖼️</p>
            <p className="text-lg font-medium">Belum ada foto di kategori ini</p>
          </div>
        ) : (
          <div className="columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">
            {filtered.map(item => (
              <div
                key={item.id}
                className="break-inside-avoid group relative rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-shadow"
                onClick={() => setLightbox(item)}
              >
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  width={400}
                  height={300}
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-primary-900/0 group-hover:bg-primary-900/60 transition-all duration-300 flex flex-col items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-center px-4">
                    <p className="text-white font-semibold text-sm leading-snug">{item.title}</p>
                    {item.caption && <p className="text-white/70 text-xs mt-1">{item.caption}</p>}
                    <span className="mt-2 inline-block px-2.5 py-0.5 rounded-full bg-gold text-primary-900 text-xs font-semibold">{item.category}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            onClick={() => setLightbox(null)}
          >
            <X size={20} />
          </button>
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <Image
                src={lightbox.imageUrl}
                alt={lightbox.title}
                width={1200}
                height={800}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            </div>
            <div className="mt-3 text-center">
              <p className="text-white font-semibold">{lightbox.title}</p>
              {lightbox.caption && <p className="text-white/60 text-sm mt-1">{lightbox.caption}</p>}
              <span className="mt-2 inline-block px-3 py-1 rounded-full bg-gold text-primary-900 text-xs font-semibold">{lightbox.category}</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
