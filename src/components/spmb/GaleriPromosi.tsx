"use client";
import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import type { IsiGambar } from "@/lib/spmb-konten";

/** Galeri foto promosi SPMB — gulir samping di HP, kisi di layar lebar; diketuk untuk melihat besar.
 *  Foto ditampilkan UTUH (`object-contain`) di atas salinannya yang diburamkan: panitia mengunggah
 *  gambar berbagai bentuk (foto mendatar, flyer tegak, gambar produk), dan `object-cover` dulu
 *  memotong isinya (temuan user 2 Okt 2026). Bentuk bingkai (`rasio`) & cara isi (`isi`) dipilih
 *  panitia di Pusat SPMB; bingkai lanskap memakai kolom lebih sedikit supaya tidak terlalu kecil. */
export default function GaleriPromosi({ foto, rasio = null, isi = "utuh" }: {
  foto: string[]; rasio?: number | null; isi?: IsiGambar;
}) {
  const [besar, setBesar] = useState<string | null>(null);
  if (!foto.length) return null;
  const r = rasio ?? 4 / 3;            // "Otomatis" di galeri = bingkai 4:3, gambar tetap utuh
  const lanskap = r > 1.05;

  return (
    <>
      <div className={`flex gap-3 overflow-x-auto pb-2 scrollbar-hide sm:grid sm:gap-4 sm:overflow-visible ${
        lanskap ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-3 lg:grid-cols-4"}`}>
        {foto.map((url, i) => (
          <button key={url} type="button" onClick={() => setBesar(url)}
            style={{ aspectRatio: `${r}` }}
            className={`group relative shrink-0 overflow-hidden rounded-2xl bg-white/5 ring-1 ring-white/15 transition sm:w-auto ${
              lanskap ? "w-72" : "w-52"}`}>
            {isi === "utuh" && (
              <Image src={url} alt="" aria-hidden fill sizes="(max-width: 640px) 18rem, 33vw"
                className="scale-110 object-cover opacity-50 blur-xl" />
            )}
            <Image src={url} alt={`Foto promosi ${i + 1}`} fill sizes="(max-width: 640px) 18rem, 33vw"
              className={`${isi === "penuh" ? "object-cover" : "object-contain"} transition duration-500 group-hover:scale-105`} />
          </button>
        ))}
      </div>

      {besar && (
        <div role="dialog" aria-modal="true" onClick={() => setBesar(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <button type="button" onClick={() => setBesar(null)} aria-label="Tutup"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20">
            <X size={20} />
          </button>
          <Image src={besar} alt="Foto promosi" width={1400} height={900}
            className="max-h-[85dvh] w-auto rounded-2xl object-contain" />
        </div>
      )}
    </>
  );
}
