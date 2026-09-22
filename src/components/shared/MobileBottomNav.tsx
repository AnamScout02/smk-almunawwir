"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import Icon from "@/components/ui/Icon";
import { simbolTersedia } from "@/lib/simbol-material";

export interface ItemNavBawah {
  href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number;
  /** Nama ikon Material Symbols (mis. "home", "qr_code_scanner"). Bila diisi, bar bawah memakai ikon ini
   * supaya yang TERPILIH tampil BERISI (sumbu FILL 1) dan yang tidak hanya garis — lucide tidak punya
   * varian berisi (permintaan user 18 September 2026, contoh dari galeri Material Symbols). */
  simbol?: string;
}

/** BOTTOM NAVIGATION HP — LIMA MENU UTAMA, TANPA BOTTOM SHEET (keputusan user 18 September 2026,
 * mengganti pola lama "4 slot + sheet berisi grup menu").
 *
 * Alasan perubahan: sheet membuat menu "bersembunyi" di dalam laci kedua, dan tiap portal
 * menyusun isinya sendiri sehingga tidak pernah benar-benar seragam. Sekarang:
 *   - 4 tautan LANGSUNG (dua kiri, dua kanan) = menu yang benar-benar dipakai harian di portal itu,
 *   - 1 tombol bulat menonjol di TENGAH = Dashboard (beranda portal),
 *   - SELURUH menu lain ada di dashboard sebagai kisi ikon (`MenuLengkap`) — jadi tidak ada lagi
 *     menu yang hanya bisa dicapai lewat laci.
 * Contoh acuan yang dikirim user: bottom bar aplikasi Livin' (bar terang + tombol tengah menonjol).
 * Desktop tidak berubah (tetap `<aside>` sidebar, §3.4 DESIGN_SYSTEM). */
export default function MobileBottomNav({ items, beranda }: {
  items: ItemNavBawah[];
  beranda: { href: string; label?: string; icon: LucideIcon; simbol?: string; badge?: number };
}) {
  const pathname = usePathname();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Ikon Material baru dipakai SETELAH fontnya benar-benar termuat; sebelumnya (atau bila gagal) ikon lucide —
  // tidak pernah tulisan "fact_check"/"school" yang mendorong tata letak (audit HP 21 Sep 2026).
  const [simbolSiap, setSimbolSiap] = useState(false);
  useEffect(() => {
    const f = typeof document !== "undefined" ? document.fonts : undefined;
    if (!f?.load) return;
    // load() mengembalikan daftar kosong bila @font-face-nya tidak ada (CSS Google Fonts gagal dimuat).
    f.load('24px "Material Symbols Outlined"', "home").then(daftar => { if (daftar.length) setSimbolSiap(true); }).catch(() => {});
  }, []);

  // Sembunyikan bar saat keyboard virtual terbuka — tanpa ini bar `fixed bottom-0` melayang di atas
  // keyboard di banyak WebView Android (dideteksi dari penyusutan visualViewport > 120px).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let maxHeight = vv.height;
    const onResize = () => { maxHeight = Math.max(maxHeight, vv.height); setKeyboardOpen(maxHeight - vv.height > 120); };
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", onResize);
    return () => { vv.removeEventListener("resize", onResize); vv.removeEventListener("scroll", onResize); };
  }, []);

  const aktif = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  const berandaAktif = pathname === beranda.href;
  const empat = items.slice(0, 4);
  const kiri = empat.slice(0, 2);
  const kanan = empat.slice(2, 4);
  const IkonBeranda = beranda.icon;

  const Tab = ({ item }: { item: ItemNavBawah }) => {
    const LucideIkon = item.icon;
    const on = aktif(item.href, item.exact);
    return (
      <Link href={item.href} aria-current={on ? "page" : undefined}
        className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors ${on ? "text-primary-900" : "text-gray-400"}`}>
        <span className="relative inline-flex">
          {/* Terpilih = ikon BERISI, tidak terpilih = garis saja. Ikon Material Symbols dipakai bila ada
              `simbol`; sisanya jatuh ke lucide dengan fill lembut sebagai cadangan. */}
          {simbolSiap && simbolTersedia(item.simbol)
            ? <Icon name={item.simbol} size={23} filled={on} />
            : <LucideIkon size={21} strokeWidth={on ? 2.3 : 1.8} fill={on ? "currentColor" : "none"} fillOpacity={on ? 0.18 : 0} />}
          {(item.badge ?? 0) > 0 && <span className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />}
        </span>
        <span className={`w-full truncate text-center text-[0.72rem] leading-none ${on ? "font-bold" : "font-medium"}`}>{item.label}</span>
      </Link>
    );
  };

  return (
    <nav aria-label="Navigasi utama"
      className={`lg:hidden print:hidden fixed inset-x-0 bottom-0 z-50 border-t border-gray-100 bg-white shadow-[0_-6px_20px_rgba(15,26,69,0.10)] ${keyboardOpen ? "!hidden" : ""}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="relative flex h-16 items-stretch">
        {kiri.map(i => <Tab key={i.href} item={i} />)}

        {/* Tombol tengah = Dashboard. Menonjol ke atas seperti contoh yang dikirim user; lingkaran
            navy bergradien dengan cincin putih supaya tetap terbaca di atas bar terang. */}
        <div className="flex w-[22%] shrink-0 justify-center">
          <Link href={beranda.href} aria-current={berandaAktif ? "page" : undefined}
            className="absolute -top-6 flex flex-col items-center gap-1">
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-white ring-4 ring-white transition-transform ${berandaAktif ? "scale-105" : ""}`}
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)", boxShadow: "0 8px 20px rgba(15,26,69,0.35)" }}>
              {simbolSiap && simbolTersedia(beranda.simbol)
                ? <Icon name={beranda.simbol} size={26} filled={berandaAktif} className={berandaAktif ? "text-gold" : "text-white"} />
                : <IkonBeranda size={24} strokeWidth={2.1} fill={berandaAktif ? "currentColor" : "none"} fillOpacity={berandaAktif ? 0.25 : 0} className={berandaAktif ? "text-gold" : "text-white"} />}
              {(beranda.badge ?? 0) > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />}
            </span>
            <span className={`text-[0.72rem] leading-none ${berandaAktif ? "font-bold text-primary-900" : "font-medium text-gray-500"}`}>{beranda.label ?? "Beranda"}</span>
          </Link>
        </div>

        {kanan.map(i => <Tab key={i.href} item={i} />)}
      </div>
    </nav>
  );
}
