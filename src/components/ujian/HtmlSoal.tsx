"use client";
import { createElement, useEffect, useRef } from "react";
import "katex/dist/katex.min.css";

/** Menampilkan HTML soal (pertanyaan, pilihan, wacana) + RUMUS MATEMATIKA & KIMIA.
 *
 * Rumus ditulis gaya LaTeX di dalam teks biasa — guru tidak perlu alat khusus (atau pakai Palet Rumus):
 *   $x^2 + \sqrt{y}$  atau  \( ... \)   → rumus di dalam kalimat
 *   $$\frac{a}{b}$$   atau  \[ ... \]   → rumus berdiri sendiri di tengah baris
 *   $\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}$ → rumus/reaksi KIMIA (mhchem, 22 Sep 2026)
 * KaTeX hanya dimuat kalau teksnya memang mengandung penanda rumus, jadi soal biasa tidak
 * menanggung beban pustakanya. Rumus yang salah tulis ditampilkan apa adanya (tidak merusak soal). */

const ADA_RUMUS = /\$|\\\(|\\\[/;

export async function renderRumus(el: HTMLElement) {
  const [{ default: renderMathInElement }] = await Promise.all([
    import("katex/contrib/auto-render"),
    // Ekstensi kimia \ce{…} & \pu{…} — mendaftarkan dirinya ke KaTeX saat dimuat.
    import("katex/contrib/mhchem"),
  ]);
  renderMathInElement(el, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "$", right: "$", display: false },
    ],
    throwOnError: false,
    ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code", "option", "audio"],
  });
}

export default function HtmlSoal({ html, className, as = "div" }: { html: string; className?: string; as?: "div" | "span" }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current || !ADA_RUMUS.test(html)) return;
    let batal = false;
    const el = ref.current;
    renderRumus(el).then(() => { if (batal) return; }).catch(() => {});
    return () => { batal = true; };
  }, [html]);

  // Kelas penanda `soal-html` selalu ikut supaya tabel hasil impor Word punya garis & jarak
  // (gaya ada di globals.css) — tanpa itu tabelnya tampil polos tanpa batas sel.
  return createElement(as, { ref, className: className ? `soal-html ${className}` : "soal-html", dangerouslySetInnerHTML: { __html: html } });
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** TEKS POLOS + RUMUS — untuk JAWABAN SISWA (uraian/isian) di layar ujian, koreksi, dan hasil. Isinya di-escape dulu
 * (siswa tidak boleh menyisipkan HTML/skrip), baris baru dipertahankan, lalu `$…$` dirender KaTeX. */
export function TeksRumus({ teks, className }: { teks: string; className?: string }) {
  const html = escapeHtml(teks ?? "").replace(/\n/g, "<br>");
  return <HtmlSoal html={html} className={className} />;
}
