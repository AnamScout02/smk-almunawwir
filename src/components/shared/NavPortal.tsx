"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import MobileBottomNav, { type ItemNavBawah } from "@/components/shared/MobileBottomNav";
import { IKON, SIMBOL, type ItemNavPortal } from "@/components/shared/ikon-portal";

export type { ItemNavPortal };

/** BOTTOM NAVBAR portal di HP & tablet (<lg) — Pusat Perpustakaan, Perpustakaan Digital, Pusat Ujian; dirender PortalShell
 * dari prop `menu`. `MobileBottomNav` yang sama dengan portal dashboard (permintaan user 15 Sep 2026: "di perpustakaan dan
 * ujian kenapa tidak ada bottom navbar"). Di layar lebar menu tampil sebagai PITA TAB di bawah header halaman — lihat
 * `PitaPortal` (21 September 2026: pita dipindah dari kepala portal ke bawah header halaman). */
export default function NavPortal({ items }: { items: ItemNavPortal[] }) {
  // Bottom nav HP (18 Sep 2026, seragam dengan portal dashboard): menu PERTAMA jadi tombol tengah
  // (beranda portal), empat menu berikutnya jadi tab. Menu selebihnya tidak "disembunyikan di laci" —
  // beranda portal menampilkan SELURUH menu sebagai kisi ikon (`KisiMenuPortal`).
  const navBawah: ItemNavBawah[] = items.slice(1, 5).map(i => ({ href: i.href, label: i.singkat ?? i.label, icon: IKON[i.ikon], simbol: SIMBOL[i.ikon], exact: !!i.persis }));
  const beranda = items[0];

  return (
    <>
      {/* Di luar <nav> ber-backdrop-blur: backdrop-filter menjadikan leluhurnya acuan `position: fixed`, bar bawah jadi ikut menempel di kepala. */}
      {beranda && <MobileBottomNav items={navBawah} beranda={{ href: beranda.href, icon: IKON[beranda.ikon], simbol: SIMBOL[beranda.ikon], label: beranda.singkat ?? beranda.label }} />}
    </>
  );
}

/** KISI SELURUH MENU PORTAL — dipasang di beranda portal (Pusat Perpustakaan, Pusat Ujian, dst) supaya
 * semua menu tetap terjangkau di HP, tempat bottom navbar hanya memuat 5 slot (keputusan user 18 Sep 2026).
 * SENGAJA `lg:hidden`: di layar lebar bar tab portal sudah menampilkan seluruh menu, jadi kisi ini akan
 * terlihat sebagai menu dobel (temuan user 18 Sep 2026). */
export function KisiMenuPortal({ items, judul = "Menu Portal" }: { items: ItemNavPortal[]; judul?: string }) {
  const path = usePathname();
  return (
    <section className="panel p-4 sm:p-5 lg:hidden">
      <p className="label-kecil mb-3">{judul}</p>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-8">
        {items.map(i => {
          const Ikon = IKON[i.ikon];
          const on = path === i.href;
          return (
            <li key={i.href}>
              <Link href={i.href}
                className={`flex h-full flex-col items-center gap-1.5 rounded-2xl px-1 py-3 text-center transition ${on ? "bg-primary-50" : "hover:bg-gray-50"}`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-50 text-primary-700"><Ikon size={19} /></span>
                <span className="w-full text-xs font-medium leading-tight text-gray-700">{i.singkat ?? i.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
