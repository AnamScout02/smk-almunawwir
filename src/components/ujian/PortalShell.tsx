import Link from "next/link";
import { LogOut, ArrowLeft } from "lucide-react";
import { logout } from "@/app/actions/auth";
import UkurKepalaPortal from "@/components/ujian/UkurKepalaPortal";
import NavPortal from "@/components/shared/NavPortal";
import { PitaPortalProvider } from "@/components/shared/PitaPortal";
import type { ItemNavPortal } from "@/components/shared/ikon-portal";

/** Kulit PORTAL UJIAN — dipakai bersama oleh portal petugas (/pusat-ujian) dan portal peserta
 * (/ujian-online).
 *
 * Sengaja berupa portal tersendiri, bukan satu menu di dalam dashboard: begitu proktor atau siswa
 * masuk, seluruh layar harus terasa "ruang ujian" tanpa gangguan menu lain. Bilah atasnya navy
 * bergradien + motif SMK seperti kop dokumen dan header dashboard, memakai logo BERTEKS
 * (logo-full-white) — bukan lambang bulat kecil, yang membuat bilahnya terlihat kosong
 * (temuan user 13 September 2026). */

const NAVY = "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)";

export default function PortalShell({
  logoUrl, judul, subjudul, nama, peran, kembaliHref, kembaliLabel, adaKeluar = false, menu, children,
}: {
  /** Menu portal: pita tab di bawah header halaman (layar lebar, `PitaPortal`) + bottom navbar (HP, `NavPortal`). */
  menu?: ItemNavPortal[];
  logoUrl?: string;
  judul: string;
  subjudul: string;
  /** Nama pengguna yang sedang masuk — ditampilkan di kanan supaya proktor yakin memakai akun yang benar. */
  nama?: string;
  peran?: string;
  kembaliHref?: string;
  kembaliLabel?: string;
  adaKeluar?: boolean;
  children: React.ReactNode;
}) {
  return (
    // print:bg-white! — latar abu portal (inline style) ikut tercetak di ruang kosong halaman cetak (7 Okt 2026).
    <div className="min-h-dvh flex flex-col print:bg-white!" style={{ backgroundColor: "#f0f2f7" }}>
      {/* Kepala portal MENEMPEL (temuan user 15 Sep 2026: bar atas portal hilang saat digulir). Tingginya diukur
          UkurKepalaPortal → --tinggi-kepala-portal, dipakai PageHeader di dalam portal supaya menempel di bawahnya; pita menu
          tab menempel di bawah PageHeader (PitaPortal, 21 Sep 2026 — dulu pita ikut di dalam kepala ini, di atas header). */}
      <div id="kepala-portal" className="sticky top-0 z-40 print:hidden">
      <header className="relative overflow-hidden" style={{ background: NAVY }}>
        <div className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{ backgroundImage: "url('/images/pattern-smk-miring.png')", backgroundSize: "169.71px 169.71px", filter: "invert(1)" }} />
        <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full opacity-25 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #E8A020 0%, transparent 70%)" }} />

        <div className="relative max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-4">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="SMK Al Munawwir IIBS" className="h-9 sm:h-10 w-auto object-contain shrink-0" />
          ) : null}
          <span className="hidden sm:block w-px h-8 bg-white/20 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-heading font-bold text-white text-sm sm:text-base leading-tight truncate">{judul}</p>
            <p className="font-heading font-semibold text-gold text-xs sm:text-xs uppercase tracking-[0.12em] leading-tight truncate">{subjudul}</p>
          </div>

          {nama ? (
            <div className="hidden md:block text-right shrink-0">
              <p className="text-white text-xs font-semibold leading-tight truncate max-w-[14rem]">{nama}</p>
              {peran ? <p className="text-white/50 text-xs uppercase tracking-wide leading-tight">{peran}</p> : null}
            </div>
          ) : null}

          {kembaliHref ? (
            <Link href={kembaliHref}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-white/10 text-xs font-semibold transition shrink-0">
              <ArrowLeft size={14} /> <span className="hidden sm:inline">{kembaliLabel ?? "Kembali"}</span>
            </Link>
          ) : null}

          {adaKeluar ? (
            <form action={logout} className="shrink-0">
              <button type="submit" title="Keluar"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/20 text-white/80 hover:text-white hover:bg-red-500/30 text-xs font-semibold transition">
                <LogOut size={14} /> <span className="hidden sm:inline">Keluar</span>
              </button>
            </form>
          ) : null}
        </div>

        {/* garis emas pemisah — penanda yang sama dengan kartu QR & dokumen cetak */}
        <div className="h-[3px] relative" style={{ background: "linear-gradient(90deg, #B87D0E 0%, #F5C842 50%, #B87D0E 100%)" }} />
      </header>
      </div>
      <UkurKepalaPortal />
      {menu?.length ? <NavPortal items={menu} /> : null}

      {/* Portal tidak punya top bar mobile yang fixed → padding atas PageHeader cukup seperti desktop. */}
      {/* Ada navigasi portal → di HP ada bottom navbar (NavPortal), jadi isi paling bawah diberi ruang setinggi bar itu. */}
      <main data-portal="1" className={`flex-1 ${menu?.length ? "pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0 print:pb-0" : ""}`} style={{ "--pageheader-top": "var(--tinggi-kepala-portal, 64px)", "--pageheader-pt": "1.25rem" } as React.CSSProperties}>
        {menu?.length ? <PitaPortalProvider items={menu}>{children}</PitaPortalProvider> : children}
      </main>
    </div>
  );
}
