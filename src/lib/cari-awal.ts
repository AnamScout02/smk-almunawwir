"use client";
import { useEffect } from "react";

/** TAUTAN LANGSUNG KE SATU DATA (10 Okt 2026, permintaan user): butir di Meja Kerja TU dan daftar perbaikan data membuka
 *  halaman tujuannya SUDAH tersaring ke data itu — `?cari=<kata>` mengisi kotak cari daftar. Dibaca sekali saat halaman
 *  dimuat (bukan `useSearchParams`, supaya halaman tidak perlu dibungkus Suspense). Daftar baru yang punya kotak cari
 *  cukup memanggil `useCariAwal(setSearch)`. */
export function useCariAwal(setel: (v: string) => void, kunci = "cari") {
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(kunci);
    if (v) setel(v.slice(0, 120));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Gulir ke SATU ISIAN di dalam bagian formulir (`[data-bagian-induk]`) lalu sorot & fokuskan — "yang kurang NISN ya langsung
 *  ke NISN". `calon` = beberapa awalan label yang dicoba berurutan (label formulir bisa berubah; yang pertama ketemu dipakai).
 *  Tidak ketemu = cukup bagian itu yang digulir, jadi tautan lama tidak pernah gagal total. */
export function sorotIsian(bagian: string, calon: string[], tunda = 350) {
  return setTimeout(() => {
    const wadah = document.querySelector<HTMLElement>(`[data-bagian-induk="${bagian}"]`);
    if (!wadah) return;
    const label = [...wadah.querySelectorAll<HTMLElement>("label")];
    let kena: HTMLElement | undefined;
    for (const c of calon) { const k = c.trim().toLowerCase(); if (!k) continue; kena = label.find(l => (l.textContent ?? "").trim().toLowerCase().startsWith(k)); if (kena) break; }
    const sasaran = kena?.parentElement ?? wadah;
    sasaran.scrollIntoView({ block: kena ? "center" : "start", behavior: "smooth" });
    if (!kena) return;
    sasaran.style.transition = "box-shadow .3s"; sasaran.style.borderRadius = "12px";
    sasaran.style.boxShadow = "0 0 0 3px rgba(232,160,32,.55)";
    setTimeout(() => { sasaran.style.boxShadow = ""; }, 4000);
    sasaran.querySelector<HTMLElement>("input:not([type=hidden]), textarea, button")?.focus({ preventScroll: true });
  }, tunda);
}

/** Sorot SATU BARIS daftar: `?sorot=<id>` → elemen ber-`data-baris="<id>"` digulir ke tengah & diberi cincin emas 4 detik.
 *  Untuk daftar tanpa kotak cari (permintaan surat, pesan, arsip SK, kelompok nama sekolah). Daftarnya dimuat lewat fetch,
 *  jadi elemen ditunggu sampai ±8 detik. `saatKetemu` dipakai halaman yang perlu membuka barisnya (mis. pesan). */
export function useSorotBaris(saatKetemu?: (id: string) => void) {
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("sorot");
    if (!id) return;
    let coba = 0, lepas: ReturnType<typeof setTimeout> | undefined;
    const t = setInterval(() => {
      const e = [...document.querySelectorAll<HTMLElement>("[data-baris]")].find(x => x.dataset.baris === id);
      if (!e && ++coba < 32) return;
      clearInterval(t);
      if (!e) return;
      e.scrollIntoView({ block: "center", behavior: "smooth" });
      e.style.transition = "box-shadow .3s"; e.style.boxShadow = "inset 0 0 0 3px rgba(232,160,32,.6)";
      lepas = setTimeout(() => { e.style.boxShadow = ""; }, 4000);
      saatKetemu?.(id);
    }, 250);
    return () => { clearInterval(t); if (lepas) clearTimeout(lepas); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
