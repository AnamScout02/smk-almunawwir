"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import { BellRing, ChevronRight, CircleUserRound, Download, Globe, IdCard, Loader2, LogOut, Search, UserCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { logout } from "@/app/actions/auth";
import BottomSheet from "@/components/shared/BottomSheet";

export interface TautanAkun { href: string; label: string; icon: LucideIcon }

/** Tombol "Akun" di bar atas MOBILE tiap portal → sheet berisi Profil, tautan tambahan, Lihat Website,
 * dan KELUAR.
 *
 * Latar (14 September 2026, temuan user "versi mobile tidak ada tombol keluar"): sejak hamburger+drawer
 * diganti `MobileBottomNav` (§3.6 DESIGN_SYSTEM), tombol Keluar hanya tersisa di sidebar desktop
 * (`hidden lg:flex`) — di HP portal Admin/TAS/Guru/Siswa tidak ada cara keluar sama sekali. Sheet bottom
 * nav sengaja hanya berisi tautan menu, jadi aksi akun ditaruh di sini: SATU komponen untuk semua
 * portal. Sidebar portal baru yang memakai MobileBottomNav WAJIB memasang komponen ini di bar atasnya. */
export default function MenuAkunMobile({ profilHref, tautanTambahan = [] }: { profilHref?: string; tautanTambahan?: TautanAkun[] }) {
  const [buka, setBuka] = useState(false);
  const pathname = usePathname();

  // Tutup sheet saat pindah halaman (komponen ini hidup di layout, tidak ikut remount).
  useEffect(() => { setBuka(false); }, [pathname]);

  const tautan: TautanAkun[] = [
    ...(profilHref ? [{ href: profilHref, label: "Profil Saya", icon: UserCircle }] : []),
    ...(profilHref ? [{ href: `${profilHref}#notifikasi`, label: "Notifikasi", icon: BellRing }] : []),
    { href: "/kartu-identitas", label: "Kartu Identitas", icon: IdCard },
    ...tautanTambahan,
    { href: "/pasang-aplikasi", label: "Aplikasi MyAlwis", icon: Download },
    { href: "/", label: "Lihat Website", icon: Globe },
  ];

  return (
    <>
      <button type="button" onClick={() => setBuka(true)} title="Akun" aria-label="Menu akun"
        className="p-1.5 -mr-1.5 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors">
        <CircleUserRound size={22} />
      </button>

      <BottomSheet open={buka} onClose={() => setBuka(false)} title="Akun">
        <div className="py-2 pb-4">
          {/* Pencarian cepat: di HP tidak ada pintasan Ctrl+K, jadi pintunya di sini (lihat PencarianCepat.tsx). */}
          <button type="button" onClick={() => { setBuka(false); window.dispatchEvent(new Event("buka-pencarian")); }}
            className="flex w-full items-center gap-3 mx-3 px-3 py-3 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors" style={{ width: "calc(100% - 1.5rem)" }}>
            <span className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0"><Search size={17} /></span>
            <span className="flex-1 text-left">Pencarian Cepat</span>
            <ChevronRight size={15} className="text-gray-300" />
          </button>
          {tautan.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setBuka(false)}
              className="flex items-center gap-3 mx-3 px-3 py-3 rounded-2xl text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <span className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
                <Icon size={17} />
              </span>
              <span className="flex-1">{label}</span>
              <ChevronRight size={15} className="text-gray-300" />
            </Link>
          ))}
          <div className="mx-5 my-2 border-t border-gray-100" />
          <form action={logout} className="mx-3">
            <TombolKeluar />
          </form>
        </div>
      </BottomSheet>
    </>
  );
}

function TombolKeluar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold text-red-600 hover:bg-red-50 active:bg-red-100 disabled:opacity-60 transition-colors">
      <span className="w-9 h-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <LogOut size={17} />}
      </span>
      <span className="flex-1 text-left">{pending ? "Keluar..." : "Keluar"}</span>
    </button>
  );
}
