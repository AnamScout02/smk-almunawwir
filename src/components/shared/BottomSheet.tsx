"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

/** Sheet yang naik dari tepi bawah layar — padanan mobile dari `Modal.tsx` (dipakai KHUSUS
 * `MobileBottomNav`, lihat komentar di situ). Portal ke `document.body` (pola sama persis
 * `Select.tsx`/`DatePicker.tsx`) supaya tidak ke-clip ancestor `overflow-hidden` apa pun, dan
 * `z-[60]` (bukan `z-50` spt Modal) supaya selalu di ATAS bottom nav bar (`z-50`) yang memicunya —
 * lihat DESIGN_SYSTEM.md §15.5. Tutup lewat: tap backdrop, tombol X, atau Escape — TIDAK ada
 * swipe-to-dismiss (sengaja disederhanakan utk v1, lihat plan).
 *
 * SENGAJA berhenti di atas nav (bukan `inset-0` penuh) — referensi desain dari repo eksternal
 * (billing-technofix, diadaptasi 2026-08-23): backdrop+panel TIDAK menutupi bottom nav bar di
 * bawahnya, jadi nav tetap kelihatan & bisa langsung dipakai ganti tab tanpa tutup sheet dulu.
 * Batas bawah `calc(4rem + safe-area-inset-bottom)` HARUS SAMA dengan tinggi total
 * `MobileBottomNav`/`pb-[...]` di `<main>` tiap layout (termasuk padding aman device ber-notch,
 * bukan `bottom-16` polos — fix responsif 2026-08-23) — kalau tinggi nav berubah, sesuaikan juga
 * nilai ini di semua tempat. Panel sendiri RATA/flush ke bawah (nempel pas di atas nav, sudut
 * cuma membulat di atas) — bentuk "kartu melayang" (sudut bawah bulat + margin) sempat dicoba
 * lalu DIBATALKAN user 2026-08-23, kembali ke gaya flush biasa. */
export default function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // Keyboard HP: sheet biasanya menempel di dasar layar sehingga kotak cari menu tertutup keyboard (temuan user 15 Sep 2026).
  // Tinggi keyboard diukur dari visualViewport; selama keyboard terbuka sheet diangkat tepat di atasnya (bottom nav memang
  // disembunyikan MobileBottomNav saat keyboard terbuka) dan tingginya dibatasi ke area yang masih terlihat.
  const [keyboard, setKeyboard] = useState({ tinggi: 0, terlihat: 0 });
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const ukur = () => {
      const tinggi = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboard(tinggi > 120 ? { tinggi, terlihat: vv.height } : { tinggi: 0, terlihat: 0 });
    };
    ukur();
    vv.addEventListener("resize", ukur);
    vv.addEventListener("scroll", ukur);
    return () => { vv.removeEventListener("resize", ukur); vv.removeEventListener("scroll", ukur); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    // Cegah body ikut ter-scroll di belakang sheet selagi terbuka (sheet sendiri scrollable).
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // Panel turun SAMPAI dasar layar (bottom-0), MENUTUPI bottom navbar termasuk tombol bulat di
    // tengahnya — dulu berhenti di atas bar sehingga tombol tengah yang menonjol menembus panel
    // (temuan user 18 September 2026). Isi panel diberi ruang aman sendiri di bawah.
    <div className={`lg:hidden fixed inset-x-0 top-0 z-[60] flex items-end ${keyboard.tinggi ? "" : "bottom-0"}`}
      style={keyboard.tinggi ? { bottom: keyboard.tinggi } : undefined} onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] sheet-backdrop-in" />
      <div
        className="relative w-full max-h-[78dvh] bg-white rounded-t-3xl shadow-2xl flex flex-col sheet-panel-in pb-[env(safe-area-inset-bottom)]"
        style={keyboard.tinggi ? { maxHeight: Math.max(220, keyboard.terlihat - 16) } : undefined}
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-center pt-2.5 pb-1">
          <div className="w-10 h-1.5 rounded-full bg-gray-200" />
        </div>
        <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h3 className="font-heading font-semibold text-navy text-base">{title}</h3>
          <button onClick={onClose} title="Tutup" className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
