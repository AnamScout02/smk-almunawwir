"use client";
import { useEffect } from "react";

/** Parallax ringan: setiap elemen `[data-parallax="0.25"]` digeser vertikal sebanding guliran,
 *  sehingga motif & cahaya latar bergerak lebih lambat dari isinya (kesan berlapis). Hanya di layar
 *  lebar dan bila pengguna TIDAK memilih "kurangi gerak"; satu pendengar gulir, dibatasi per bingkai. */
export default function ParallaxSpmb() {
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");
    if (!mq.matches) return;
    const el = [...document.querySelectorAll<HTMLElement>("[data-parallax]")];
    if (!el.length) return;
    let antre = 0;
    const geser = () => {
      antre = 0;
      const y = window.scrollY;
      for (const e of el) e.style.transform = `translate3d(0, ${y * Number(e.dataset.parallax || 0)}px, 0)`;
    };
    const saatGulir = () => { if (!antre) antre = requestAnimationFrame(geser); };
    window.addEventListener("scroll", saatGulir, { passive: true });
    geser();
    return () => {
      window.removeEventListener("scroll", saatGulir);
      cancelAnimationFrame(antre);
      for (const e of el) e.style.transform = "";
    };
  }, []);
  return null;
}
