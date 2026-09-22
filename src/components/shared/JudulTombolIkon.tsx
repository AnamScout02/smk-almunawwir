"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Tombol aksi di `.alat-aksi` (dan `.btn-ikon`) ditampilkan IKON SAJA demi menghemat ruang
 * (permintaan user 18 September 2026). Teksnya tetap ada di DOM untuk pembaca layar, tetapi mouse
 * tidak punya petunjuk apa pun — komponen ini menyalin teks tombol ke atribut `title` (dan
 * `aria-label` bila belum ada) supaya muncul sebagai tooltip. Dipasang SEKALI di `Providers`,
 * mengikuti pola `PembekuTabel`. */
export default function JudulTombolIkon() {
  const path = usePathname();
  useEffect(() => {
    const pasang = () => {
      document.querySelectorAll<HTMLElement>(".alat-aksi .btn-modal-save, .alat-aksi .btn-modal-cancel, .alat-aksi .btn-hapus, .btn-ikon").forEach(el => {
        if (!el.querySelector("svg")) return;
        const teks = (el.textContent ?? "").trim();
        if (!teks) return;
        if (!el.title) el.title = teks;
        if (!el.getAttribute("aria-label")) el.setAttribute("aria-label", teks);
      });
    };
    pasang();
    const t = setTimeout(pasang, 600); // isi yang datang setelah fetch
    const mo = new MutationObserver(() => pasang());
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { clearTimeout(t); mo.disconnect(); };
  }, [path]);
  return null;
}
