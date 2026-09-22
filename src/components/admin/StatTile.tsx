"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IkonNama, type NamaIkon } from "@/components/shared/IkonNama";

type StatColor = "primary" | "emerald" | "amber" | "blue" | "red" | "purple" | "gray";

const COLOR_STYLES: Record<StatColor, { grad: string; ring: string }> = {
  primary: { grad: "from-primary-500 to-primary-700", ring: "ring-primary-100" },
  emerald: { grad: "from-emerald-500 to-emerald-600", ring: "ring-emerald-100" },
  amber:   { grad: "from-amber-500 to-amber-600",     ring: "ring-amber-100" },
  blue:    { grad: "from-blue-500 to-blue-600",       ring: "ring-blue-100" },
  red:     { grad: "from-red-500 to-red-600",         ring: "ring-red-100" },
  purple:  { grad: "from-purple-500 to-purple-600",   ring: "ring-purple-100" },
  gray:    { grad: "from-gray-500 to-gray-600",       ring: "ring-gray-100" },
};

/** Tampilan "lembut" — BERWARNA LEMBUT (pilihan user 15 Sep 2026, jadi patokan semua halaman): latar gradasi warna muda +
 * garis senada, chip ikon berwarna penuh (ikon putih), angka tetap navy supaya mudah dibaca. Tiap kartu boleh warna sendiri.
 * Kelas ditulis utuh (bukan dirakit) supaya Tailwind menghasilkan CSS-nya. */
const LEMBUT: Record<StatColor, { latar: string; chip: string }> = {
  primary: { latar: "from-primary-50 to-white border-primary-100", chip: "bg-primary-700 shadow-primary-700/25" },
  emerald: { latar: "from-emerald-50 to-white border-emerald-100", chip: "bg-emerald-600 shadow-emerald-600/25" },
  amber:   { latar: "from-amber-50 to-white border-amber-100",     chip: "bg-amber-500 shadow-amber-500/30" },
  blue:    { latar: "from-sky-50 to-white border-sky-100",         chip: "bg-sky-600 shadow-sky-600/25" },
  red:     { latar: "from-red-50 to-white border-red-100",         chip: "bg-red-600 shadow-red-600/25" },
  purple:  { latar: "from-violet-50 to-white border-violet-100",   chip: "bg-violet-600 shadow-violet-600/25" },
  gray:    { latar: "from-gray-50 to-white border-gray-200",       chip: "bg-gray-500 shadow-gray-500/25" },
};

interface StatTileProps {
  value: React.ReactNode;
  label: string;
  sublabel?: string;
  // Boleh ElementType (mis. `icon={Users}`) KHUSUS dipanggil dari Client Component (pola lama,
  // masih dipakai ~25 halaman "use client" yang sudah ada — aman krn tidak melewati batas
  // Server→Client). Server Component (halaman TANPA "use client") WAJIB kirim JSX sudah-dirender
  // (`icon={<Users />}`) — referensi fungsi mentah tidak bisa diserialisasi lewat batas RSC
  // ("Functions cannot be passed directly to Client Components"), lihat gotcha terkait di StatTile
  // dipakai dari Server Component (student/rapor, admin/students/[id], dkk — insiden 2026-08-28).
  icon?: React.ElementType | React.ReactElement;
  /** NAMA ikon (lihat IkonNama.tsx) — WAJIB dipakai dari halaman SERVER sebagai ganti `icon={<X />}` (CLAUDE.md #35). */
  ikon?: NamaIkon;
  color?: StatColor;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Konten tambahan di bawah label (mis. progress bar `.segmented-bar`) — opsional. */
  children?: React.ReactNode;
  /** "lembut" (BAWAAN sejak 15 Sep 2026) = kartu berwarna lembut pola v2. "gradien" = kartu warna penuh lama — hanya untuk
   * kartu yang ikut TERCETAK (rapor) supaya hasil cetak tidak berubah. */
  tampilan?: "gradien" | "lembut";
  /** Kartu bisa diklik menuju halaman terkait (hanya tampilan lembut). */
  href?: string;
  /** Tandai perlu perhatian (mis. ada pendaftar menunggu) — cincin & titik berdenyut kuning (hanya tampilan lembut). */
  sorot?: boolean;
}

/** Angka menghitung naik dari 0 ke nilai akhir (ease-out, ~900ms) — diadaptasi dari `animNum()`
 * referensi eksternal (billing-technofix). HANYA aktif kalau `value` benar-benar `number` polos
 * (string/JSX lain, mis. nama identitas router, ditampilkan apa adanya tanpa animasi — tidak ada
 * "angka" utk dihitung naik). Respect `prefers-reduced-motion`: langsung tampil nilai akhir. */
function CountUp({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const prevTarget = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) { setDisplay(target); prevTarget.current = target; return; }

    const from = prevTarget.current ?? 0;
    prevTarget.current = target;
    if (from === target) { setDisplay(target); return; }

    const duration = 700;
    let raf = 0;
    const start = performance.now();
    function step(now: number) {
      const raw = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - raw, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (raw < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  return <>{display.toLocaleString("id-ID")}</>;
}

/** Kartu ringkasan angka seragam gradasi warna (mis. "Total Siswa", "Sudah Berkelas") — dipakai di seluruh panel admin.
 * `size="sm"` dipakai kalau `value` bisa berupa teks panjang (mis. nama identitas router) — biar tidak
 * bikin kartu itu lebih tinggi dari kartu angka di sebelahnya dalam satu baris grid. `truncate` juga
 * dipasang selalu sebagai jaring pengaman di layar sempit. */
export default function StatTile({
  value, label, sublabel, icon, color = "primary", size = "lg", className = "", children,
  tampilan = "lembut", href, sorot = false, ikon,
}: StatTileProps) {
  // JSX yang dikirim dari Server Component (mis. `icon={<Users />}`) sudah "diresolusi" jadi elemen
  // SVG mentah oleh React sebelum sampai ke sini (client) — cloneElement/inject prop `size` ke situ
  // TIDAK RELIABLE (bisa crash "Element type is invalid"). Jadi ukuran/warna ikon dipaksa lewat CSS
  // (selector anak `svg`), bukan prop, supaya sama-sama aman utk kedua bentuk `icon` (ElementType
  // ATAU ReactElement sudah-jadi).
  const iconNode = ikon
    ? <IkonNama nama={ikon} />
    : icon
    ? React.isValidElement(icon) ? icon : React.createElement(icon as React.ElementType)
    : null;
  const nilai = typeof value === "number" ? <CountUp target={value} /> : value;

  if (tampilan === "lembut") {
    // Tata letak (permintaan user 15 Sep 2026: "angka di sebelah ikon, teks di bawahnya"): baris atas = chip ikon + angka,
    // label selebar kartu di bawahnya. Label & angka TIDAK dipotong "…" lagi — label boleh dua baris, angka panjang
    // (mis. rupiah) turun baris; ukuran angka menyesuaikan lebar kartu lewat container query.
    const ukuranNilai = size === "sm" ? "text-base leading-snug line-clamp-2" : size === "md" ? "text-lg @[10rem]:text-xl" : "text-xl @[10rem]:text-2xl";
    const isi = (
      <>
        <div className="flex min-w-0 items-center gap-3">
          {iconNode && (
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-md [&>svg]:h-5 [&>svg]:w-5 ${LEMBUT[color].chip}`} aria-hidden="true">
              {iconNode}
            </span>
          )}
          <p className={`angka min-w-0 font-heading font-bold leading-tight text-primary-900 [overflow-wrap:anywhere] ${sorot ? "pr-4" : ""} ${ukuranNilai}`}>{nilai}</p>
        </div>
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium leading-snug text-gray-600 [text-wrap:pretty]">{label}</p>
          {sublabel && <p className="mt-0.5 text-xs text-gray-500">{sublabel}</p>}
          {children}
        </div>
        {sorot && (
          <span className="absolute right-3 top-3 flex h-2.5 w-2.5" aria-label="Perlu perhatian">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
          </span>
        )}
      </>
    );
    const kelas = `@container panel masuk-halus flex flex-col gap-2.5 bg-gradient-to-br p-4 ${LEMBUT[color].latar} ${href ? "panel-interaktif" : ""} ${sorot ? "ring-2 ring-amber-300" : ""} ${className}`;
    return href ? <Link href={href} className={kelas}>{isi}</Link> : <div className={kelas}>{isi}</div>;
  }

  const s = COLOR_STYLES[color];
  // size="sm" dibiarkan bisa turun ke 2 baris (line-clamp, bukan truncate 1 baris) supaya teks
  // panjang seperti nama identitas router tidak terpotong jadi "...IIBS" -> "II..." yang aneh dibaca.
  const sizeClass = size === "lg" ? "text-3xl truncate" : size === "sm" ? "text-sm leading-snug line-clamp-2" : "text-2xl truncate";
  const valueClass = `${sizeClass} font-heading font-bold text-white`;

  return (
    <div className={`card-fade-up group relative overflow-hidden rounded-2xl p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all bg-gradient-to-br ${s.grad} ring-1 ${s.ring} ${className}`}>
      {iconNode && (
        <div className="absolute -right-3 -bottom-3 opacity-15 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 [&>svg]:w-14 [&>svg]:h-14 [&>svg]:text-white">
          {iconNode}
        </div>
      )}
      <div className="relative">
        <p className={valueClass}>{nilai}</p>
        <p className="text-white/75 text-xs mt-0.5">{label}</p>
        {sublabel && <p className="text-white/60 text-xs">{sublabel}</p>}
        {children}
      </div>
    </div>
  );
}
