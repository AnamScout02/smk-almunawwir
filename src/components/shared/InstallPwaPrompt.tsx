"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Download, X } from "lucide-react";
import { bisaDipasang, langganPasang, pasangSekarang, sudahTerpasang } from "@/lib/pasang-pwa";
import { BERKAS_APK, NAMA_APLIKASI, lewatAplikasi } from "@/lib/aplikasi-ujian";

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 14; // muncul lagi kalau sudah lama di-dismiss, bukan permanen ilang selamanya

/** Banner kecil "Pasang Aplikasi", bottom-LEFT (kanan dipakai WhatsAppButton), diangkat di atas
 * MobileBottomNav. Tidak tampil di `/pasang-aplikasi` (halaman itu punya tombol & petunjuk sendiri),
 * dan tidak tampil di dalam aplikasi MyAlwis.
 *
 * DUA PERILAKU BERBEDA (keputusan user 30 September 2026: "langsung apk, kecuali iphone dan desktop"):
 * - **Android** → tombolnya MENGUNDUH APK terbaru langsung, bukan memasang versi Chrome. Karena
 *   unduhan APK tidak bergantung pada `beforeinstallprompt`, banner ini muncul walau Chrome tidak
 *   menawarkan pemasangan. Versi Chrome (PWA) tidak punya mode ujian terkunci, notifikasi Android,
 *   dan dialog cetak — jadi di Android APK selalu yang benar.
 * - **iPhone & desktop** → tetap pasang versi browser (PWA), dan hanya muncul kalau browser benar-benar
 *   menawarkannya (`beforeinstallprompt`). APK tidak bisa dipakai di kedua perangkat itu.
 *
 * Hanya terpicu di HTTPS — lewat alamat HTTP sekolah (`:3000`) banner ini memang tidak pernah muncul. */
/** Layar dinding (papan TV, layar kegiatan, layar QR presensi): tidak ada yang mengetuk banner di sana, dan
 *  banner itu menutupi pengumuman (laporan user 4 Okt 2026 — "di tv masih muncul pasang MyAlwis Mobile"). */
const TANPA_AJAKAN = ["/pasang-aplikasi", "/layar", "/layar-kegiatan", "/hadir", "/seb-uji", "/seb-selesai"];
/** TV Android / Google TV — aplikasi HP bukan untuk TV, apa pun halamannya. */
const PERANGKAT_TV = /Android TV|GoogleTV|Google TV|SmartTV|Smart-TV|BRAVIA|AFT[A-Z]|\bTV\b|; TV|Large Screen/i;

export default function InstallPwaPrompt() {
  const pathname = usePathname();
  const [tersedia, setTersedia] = useState(false);
  const [android, setAndroid] = useState(false);
  const [ditutup, setDitutup] = useState(true);

  useEffect(() => {
    // Di dalam aplikasi MyAlwis tidak perlu ajakan memasang apa pun.
    if (lewatAplikasi(navigator.userAgent) || PERANGKAT_TV.test(navigator.userAgent)) return;
    const diAndroid = /Android/i.test(navigator.userAgent);
    setAndroid(diAndroid);
    if (!diAndroid && sudahTerpasang()) return;
    let dismissedAt = 0;
    try { dismissedAt = Number(localStorage.getItem(DISMISS_KEY) ?? 0); } catch {}
    setDitutup(dismissedAt > 0 && Date.now() - dismissedAt < DISMISS_DAYS * 86400000);
    // Android: unduhan APK selalu tersedia, tidak menunggu tawaran Chrome.
    const perbarui = () => setTersedia(diAndroid || (bisaDipasang() && !sudahTerpasang()));
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

  if (!tersedia || ditutup || TANPA_AJAKAN.some(p => pathname === p || pathname?.startsWith(p + "/"))) return null;

  return (
    <div
      className="fixed z-40 left-4 lg:left-6 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6 max-w-[300px] bg-white rounded-2xl border border-gray-100 shadow-xl p-4 flex items-start gap-3 card-fade-up print:hidden"
    >
      <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center shrink-0">
        <Download size={18} className="text-primary-700" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-navy">Pasang {NAMA_APLIKASI}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
          {android
            ? "Aplikasi resmi sekolah: notifikasi berbunyi, pindai QR, dan mode ujian terkunci."
            : "Akses lebih cepat dari layar utama HP/laptop Anda."}
        </p>
        <div className="flex items-center gap-2 mt-2.5">
          {android ? (
            <a href={BERKAS_APK} download onClick={dismiss} className="btn-modal-save px-3 text-xs">
              Unduh Aplikasi
            </a>
          ) : (
            <button type="button" onClick={install} className="btn-modal-save px-3 text-xs">
              Pasang
            </button>
          )}
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
