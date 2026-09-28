"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Download, X } from "lucide-react";
import { bisaDipasang, langganPasang, pasangSekarang, sudahTerpasang } from "@/lib/pasang-pwa";
import { lewatAplikasi } from "@/lib/aplikasi-ujian";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14; // muncul lagi kalau sudah lama di-dismiss, bukan permanen ilang selamanya

/** Banner kecil "Pasang Aplikasi" — muncul HANYA kalau browser benar2 menawarkan pemasangan (event
 * `beforeinstallprompt`, ditangkap sedini mungkin di `src/lib/pasang-pwa.ts`), bukan dipaksa tampil.
 * Ditaruh di root layout (sekali, lintas semua halaman publik & dashboard). Posisi bottom-LEFT (bukan
 * kanan, spy tidak numpuk dgn WhatsAppButton yg bottom-right) dan diangkat di atas MobileBottomNav mobile.
 * Tidak tampil di `/pasang-aplikasi` (halaman itu punya tombol & petunjuk lengkapnya sendiri). Hanya
 * terpicu di HTTPS — lewat alamat HTTP sekolah banner ini memang tidak pernah muncul. */
export default function InstallPwaPrompt() {
  const pathname = usePathname();
  const [tersedia, setTersedia] = useState(false);
  const [ditutup, setDitutup] = useState(true);

  useEffect(() => {
    if (sudahTerpasang() || lewatAplikasi(navigator.userAgent)) return; // di Aplikasi SMK Android tidak perlu ajakan pasang PWA
    let dismissedAt = 0;
    try { dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0); } catch {}
    setDitutup(dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DAYS * 86400000);
    const perbarui = () => setTersedia(bisaDipasang() && !sudahTerpasang());
    perbarui();
    return langganPasang(perbarui);
  }, []);

  function dismiss() {
    setDitutup(true);
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
  }

  async function install() {
    await pasangSekarang(); // hasilnya tdk perlu dibedakan — kedua kasus banner ditutup
    setTersedia(false);
  }

  if (!tersedia || ditutup || pathname === "/pasang-aplikasi") return null;

  return (
    <div
      className="fixed z-40 left-4 lg:left-6 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6 max-w-[300px] bg-white rounded-2xl border border-gray-100 shadow-xl p-4 flex items-start gap-3 card-fade-up print:hidden"
    >
      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
        <Download size={18} className="text-primary-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">Pasang MyAlwis</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">Akses lebih cepat dari layar utama HP/laptop Anda.</p>
        <div className="flex items-center gap-2 mt-2.5">
          <button type="button" onClick={install}
            className="btn-modal-save px-3 text-xs">
            Pasang
          </button>
          <Link href="/pasang-aplikasi" className="text-xs font-medium text-primary-700 hover:underline px-1 py-1.5">
            Bagikan
          </Link>
          <button type="button" onClick={dismiss}
            className="text-xs font-medium text-gray-400 hover:text-gray-600 px-1 py-1.5 transition-colors">
            Nanti saja
          </button>
        </div>
      </div>
      <button type="button" onClick={dismiss} title="Tutup" className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors">
        <X size={15} />
      </button>
    </div>
  );
}
