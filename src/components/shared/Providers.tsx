"use client";
import { ToastProvider } from "@/components/shared/ToastProvider";
import { ConfirmProvider } from "@/components/shared/ConfirmProvider";
import PenjagaSesiTab from "@/components/shared/PenjagaSesiTab";
import PembekuTabel from "@/components/shared/PembekuTabel";
import JudulTombolIkon from "@/components/shared/JudulTombolIkon";
import TarikMuatUlang from "@/components/shared/TarikMuatUlang";

/** Bungkus root layout dengan provider notifikasi & konfirmasi bertema (pengganti
 * window.alert()/confirm() bawaan browser) — satu titik pasang untuk seluruh app. */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        {children}
        <PenjagaSesiTab />
        {/* Freeze judul & kolom No/Nama di semua tabel layar (permintaan user 15 Sep 2026). */}
        <PembekuTabel />
        {/* Tombol aksi ikon-saja butuh tooltip dari teksnya sendiri (18 Sep 2026). */}
        <JudulTombolIkon />
        {/* Tarik ke bawah di HP = muat ulang data (28 Sep 2026) — PWA terpasang & aplikasi Android
            tidak punya gerakan bawaan peramban sama sekali. */}
        <TarikMuatUlang />
      </ConfirmProvider>
    </ToastProvider>
  );
}
