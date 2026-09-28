"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

/** TARIK UNTUK MUAT ULANG (28 September 2026, permintaan user: "untuk mobile untuk refresh
 * gimana? harusnya kan di scroll seperti aplikasi lain itu jadi refresh").
 *
 * Kenapa dibuat sendiri, bukan mengandalkan bawaan peramban: tarik-untuk-muat-ulang bawaan Chrome
 * hanya ada di TAB BIASA. Di PWA yang sudah dipasang (display-mode standalone) dan di dalam
 * aplikasi MyAlwis Mobile (WebView tanpa SwipeRefreshLayout — AndroidX sengaja tidak dipakai supaya
 * APK tetap ±140 KB) gerakan itu TIDAK ADA sama sekali, jadi pengguna HP benar-benar tidak punya
 * cara menyegarkan halaman selain menutup & membuka lagi.
 *
 * Yang dilakukan `router.refresh()` adalah memuat ulang data server component SAJA — posisi gulir,
 * isi formulir, dan state klien lain TIDAK hilang. Itu lebih baik daripada muat ulang penuh ala
 * peramban, dan itu pula alasan gerakan bawaan sengaja dimatikan (`overscroll-behavior-y: contain`)
 * supaya tidak ada dua perilaku berbeda di perangkat yang berbeda. Gaya itu dipasang DARI SINI saat
 * komponen mount: kalau komponennya gagal jalan, bawaan peramban tetap hidup sebagai cadangan. */

/* Halaman yang TIDAK boleh disegarkan dengan gerakan: layar pengerjaan ujian (gerakan tak sengaja
   saat menggulir soal tidak boleh menyentuh pengerjaan), papan dinding TV & kiosk (tidak ada yang
   menyentuhnya, dan layarnya memang dikunci setinggi layar), serta layar pindai. */
const DILEWATI = /^\/(ujian-online|layar|layar-kegiatan|hadir)(\/|$)/;

const AMBANG = 72;   // jarak tarik sebelum muat ulang dijalankan
const MAKS = 110;    // tarikan maksimum supaya indikator tidak melorot jauh

export default function TarikMuatUlang() {
  const router = useRouter();
  const pathname = usePathname();
  const [tarik, setTarik] = useState(0);
  const [memuat, mulaiMuat] = useTransition();
  const mulai = useRef<number | null>(null);
  const aktif = useRef(false);
  /* `onEnd` dipasang SEKALI tetapi butuh nilai tarik TERBARU. Kalau nilainya diambil dari state
     langsung, pendengar harus dipasang ulang tiap piksel tarikan dan gerakannya jadi patah. */
  const tarikRef = useRef(0);
  tarikRef.current = tarik;

  const mati = DILEWATI.test(pathname);

  useEffect(() => {
    if (mati) return;
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(pointer: coarse)").matches) return; // hanya perangkat sentuh

    /* Bawaan peramban dimatikan hanya selama komponen ini hidup. */
    const semula = document.documentElement.style.overscrollBehaviorY;
    document.documentElement.style.overscrollBehaviorY = "contain";

    /* Gerakan hanya sah bila SELURUH rantai wadah yang bisa digulir sedang berada di paling atas —
       kalau jari menyentuh tabel/panel yang sedang tergulir, itu gulir biasa, bukan tarik. */
    function diPuncak(target: EventTarget | null): boolean {
      let el = target as HTMLElement | null;
      while (el && el !== document.body && el !== document.documentElement) {
        const g = getComputedStyle(el).overflowY;
        if ((g === "auto" || g === "scroll") && el.scrollHeight > el.clientHeight && el.scrollTop > 0) return false;
        el = el.parentElement;
      }
      return (document.scrollingElement?.scrollTop ?? 0) <= 0;
    }

    /* Jangan mengganggu saat ada dialog/bottom sheet terbuka (gulir badan memang sedang dikunci). */
    const adaDialog = () => !!document.querySelector('[role="dialog"]') || document.body.style.overflow === "hidden";

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1 || memuat || adaDialog() || !diPuncak(e.target)) { mulai.current = null; return; }
      mulai.current = e.touches[0].clientY;
      aktif.current = false;
    }

    function onMove(e: TouchEvent) {
      if (mulai.current === null) return;
      const dy = e.touches[0].clientY - mulai.current;
      if (dy <= 0) { if (aktif.current) { aktif.current = false; setTarik(0); } return; }
      /* Menahan gerakan bawaan HANYA setelah jelas tarikan ke bawah — sebelum itu jari harus tetap
         bisa menggulir halaman seperti biasa. */
      if (dy > 6) {
        aktif.current = true;
        if (e.cancelable) e.preventDefault();
        setTarik(Math.min(MAKS, dy * 0.5)); // diperlambat supaya terasa ada tahanannya
      }
    }

    function onEnd() {
      const cukup = aktif.current && tarikRef.current >= AMBANG * 0.5;
      mulai.current = null;
      aktif.current = false;
      if (cukup) mulaiMuat(() => router.refresh());
      setTarik(0);
    }

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.documentElement.style.overscrollBehaviorY = semula;
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mati, memuat, router]);

  if (mati) return null;

  const tampil = tarik > 0 || memuat;
  const putaran = (tarik / AMBANG) * 300;

  return (
    <div
      aria-hidden={!tampil}
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{
        transform: `translateY(${memuat ? 16 : Math.max(0, tarik - 8)}px)`,
        opacity: tampil ? 1 : 0,
        transition: tarik === 0 ? "transform .25s ease-out, opacity .25s ease-out" : "opacity .1s ease-out",
      }}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-panel ring-1 ring-black/5${memuat ? " animate-spin" : ""}`}
        style={memuat ? undefined : { transform: `rotate(${putaran}deg)` }}
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" className="text-primary-700">
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <path d="M21 3v6h-6" />
        </svg>
      </span>
    </div>
  );
}
