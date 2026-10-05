"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Satu pengamat untuk semua gerak masuk di situs publik (lihat blok "GERAK SITUS PUBLIK" di
 *  globals.css). Memasang `gerak-siap` di <html> — sebelum itu tidak ada elemen yang disembunyikan,
 *  jadi bila skrip ini gagal isi halaman tetap tampil. Elemen diberi `tampak` SEKALI saat masuk
 *  layar dan tidak disembunyikan lagi saat digulir keluar (bolak-balik terasa melelahkan). */
const PILIH = ".gerak-naik, .gerak-judul, .gerak-ungkap, .gerak-batang, .gerak-alur";

export default function PengamatGerak() {
  const path = usePathname();
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = document.documentElement;
    // `.gerak-ungkap` disembunyikan dengan clip-path selebar penuh, dan Chrome menghitung luas
    // terlihatnya NOL — pengamat tidak pernah terpicu dan foto tertutup selamanya (terbukti di
    // beranda 2 Okt 2026). Untuk elemen itu yang diamati adalah INDUKNYA.
    const sasaran = new Map<Element, Set<Element>>();   // yang diamati → elemen yang ditampakkan
    const io = new IntersectionObserver(entri => {
      for (const e of entri) {
        if (!e.isIntersecting) continue;
        sasaran.get(e.target)?.forEach(el => el.classList.add("tampak"));
        sasaran.delete(e.target);
        io.unobserve(e.target);
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });

    const amati = () => document.querySelectorAll(PILIH).forEach(el => {
      if (el.classList.contains("tampak")) return;
      // Yang sudah di layar saat muat langsung tampil tanpa menunggu — mencegah kedip kosong.
      const r = el.getBoundingClientRect();
      if (!root.classList.contains("gerak-siap") && r.top < innerHeight && r.bottom > 0) el.classList.add("tampak", "gerak-diam");
      else {
        const t = el.classList.contains("gerak-ungkap") && el.parentElement ? el.parentElement : el;
        if (!sasaran.has(t)) sasaran.set(t, new Set());
        sasaran.get(t)!.add(el);
        io.observe(t);
      }
    });
    amati();
    root.classList.add("gerak-siap");
    // Isi yang dirender belakangan (tab, muat lagi) ikut diamati — dikumpulkan per bingkai supaya
    // slider/jam yang berubah tiap detik tidak memicu pencarian DOM berulang-ulang.
    let antre = 0;
    const mo = new MutationObserver(() => {
      if (!antre) antre = requestAnimationFrame(() => { antre = 0; amati(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });
    // Sorot kursor (.sorot-kursor, globals.css): SATU pendengar untuk seluruh halaman, posisinya
    // ditulis sebagai variabel CSS pada kartu yang sedang ditunjuk — bukan pendengar per kartu.
    const sorot = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest?.(".sorot-kursor") as HTMLElement | null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty("--sx", `${e.clientX - r.left}px`);
      el.style.setProperty("--sy", `${e.clientY - r.top}px`);
    };
    document.addEventListener("pointermove", sorot, { passive: true });
    return () => { io.disconnect(); mo.disconnect(); cancelAnimationFrame(antre); document.removeEventListener("pointermove", sorot); };
  }, [path]);
  return null;
}
