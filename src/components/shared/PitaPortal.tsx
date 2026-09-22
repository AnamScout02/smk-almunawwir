"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { IKON, type ItemNavPortal } from "@/components/shared/ikon-portal";

/** PITA MENU PORTAL (21 September 2026) — bar tab Pusat Ujian / Pusat Perpustakaan / Perpustakaan Digital di layar lebar.
 * Permintaan user: header halaman (mis. "Ruang Kendali Ujian") DI ATAS pita menu, dengan warna navy seragam header lain.
 * Dulu pita ini menempel di dalam kepala portal, di atas header halaman.
 *
 * Susunan sekarang: kepala portal (menempel) → PageHeader (menempel di bawahnya) → pita ini (menempel di bawah header).
 * PortalShell memasang `PitaPortalProvider` berisi daftar menu; `PageHeader` merender `<PitaPortal />` tepat setelah
 * header-nya, jadi semua halaman portal otomatis mendapat pita tanpa diubah satu per satu. Halaman portal TANPA
 * PageHeader (kiosk kunjungan, kartu anggota) memasang `<PitaPortal mandiri />` sendiri di paling atas. Di luar portal
 * (dashboard) konteksnya kosong → komponen ini tidak merender apa-apa. HP & tablet memakai bottom navbar (NavPortal). */
const MenuPortal = createContext<ItemNavPortal[] | null>(null);

export function PitaPortalProvider({ items, children }: { items: ItemNavPortal[]; children: React.ReactNode }) {
  return <MenuPortal.Provider value={items}>{children}</MenuPortal.Provider>;
}

export default function PitaPortal({ mandiri = false }: { mandiri?: boolean }) {
  const items = useContext(MenuPortal);
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  // Tinggi PageHeader tepat di atas pita — pita menempel di bawahnya. Diukur, bukan ditebak (judul/keterangan bisa 1–2 baris).
  const [tinggiHeader, setTinggiHeader] = useState(0);
  useEffect(() => {
    if (mandiri) return;
    const header = ref.current?.previousElementSibling as HTMLElement | null;
    if (!header) return;
    const pasang = () => setTinggiHeader(Math.round(header.getBoundingClientRect().height));
    pasang();
    const ro = new ResizeObserver(pasang);
    ro.observe(header);
    return () => ro.disconnect();
  }, [mandiri]);

  if (!items?.length) return null;
  const cocok = (i: ItemNavPortal) => (i.persis ? path === i.href : path === i.href || path.startsWith(`${i.href}/`));
  const hrefAktif = items.filter(cocok).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav ref={ref} aria-label="Menu portal"
      className={`pita-portal hidden lg:block sticky z-30 border-b border-gray-100 bg-white/95 backdrop-blur print:hidden ${mandiri ? "" : "-mx-8 mb-8"}`}
      style={{ top: `calc(var(--tinggi-kepala-portal, 64px) + ${tinggiHeader}px)` }}>
      {/* Kotak segmen putih — gaya yang SAMA dengan menu Pusat Ujian (permintaan user 15 Sep 2026). */}
      <div className={mandiri ? "max-w-[1600px] mx-auto px-6 py-2.5" : "px-8 py-2.5"}>
        <div className="flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide">
          {items.map(i => {
            const Ikon = IKON[i.ikon];
            const on = i.href === hrefAktif;
            return (
              <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition ${on ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
                <Ikon size={14} /> {i.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
