"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Download, X } from "lucide-react";
import { BERKAS_APK, NAMA_APLIKASI, PENANDA_APLIKASI, VERSI_APLIKASI } from "@/lib/aplikasi-ujian";

const KUNCI_TUNDA = "pita-perbarui-tunda";
/** Halaman yang tidak boleh diganggu pita: pengerjaan ujian (layar terkunci) & layar dinding. */
const TANPA_PITA = [/^\/ujian-online\/[^/]+/, /^\/layar/, /^\/hadir/];

/** Versi aplikasi dari User-Agent. Penanda lama (SMKAlMunawwirApp/SMKUjianApp) pasti lebih tua dari 2.1. */
function versiDariUa(ua: string): number[] | null {
  const m = new RegExp(`${PENANDA_APLIKASI}/(\\d+)\\.(\\d+)`).exec(ua);
  if (m) return [Number(m[1]), Number(m[2])];
  if (/SMKAlMunawwirApp|SMKUjianApp/.test(ua)) return [0, 0];
  return null;
}
const lebihTua = (a: number[], b: number[]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** PITA "VERSI BARU TERSEDIA" (5 Oktober 2026) — hanya muncul DI DALAM aplikasi Android versi lama. Satu ketukan
 *  mengunduh APK terbaru lewat pengunduh aplikasi; pengguna tinggal membuka berkasnya dan memilih "Perbarui" (paket &
 *  kunci tanda tangan sama → data & login tidak hilang). Bisa ditunda sehari. Tidak tampil saat mengerjakan ujian. */
export default function PitaPerbaruiAplikasi() {
  const jalur = usePathname() ?? "";
  const [tampil, setTampil] = useState(false);

  useEffect(() => {
    const v = versiDariUa(navigator.userAgent);
    const terbaru = VERSI_APLIKASI.split(".").map(Number);
    let ditunda = false;
    try { ditunda = Number(localStorage.getItem(KUNCI_TUNDA) ?? 0) > Date.now(); } catch { /* abaikan */ }
    queueMicrotask(() => setTampil(!!v && lebihTua(v, terbaru) && !ditunda));
  }, []);

  if (!tampil || TANPA_PITA.some(r => r.test(jalur))) return null;
  const tunda = () => {
    try { localStorage.setItem(KUNCI_TUNDA, String(Date.now() + 24 * 3600_000)); } catch { /* abaikan */ }
    setTampil(false);
  };

  return (
    <div className="fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 rounded-2xl bg-primary-900 p-4 text-white shadow-2xl lg:hidden print:hidden">
      <button type="button" onClick={tunda} aria-label="Nanti saja" className="absolute right-2 top-2 rounded-full p-1.5 text-white/60 hover:bg-white/10"><X size={16} /></button>
      <p className="pr-6 font-heading text-sm font-semibold">{NAMA_APLIKASI} {VERSI_APLIKASI} tersedia</p>
      <p className="mt-1 text-xs text-white/75">
        Kini aplikasi bisa dibuka dengan sidik jari / wajah. Ketuk Perbarui, buka berkas yang terunduh, lalu pilih &quot;Perbarui&quot; — data & login tetap.
      </p>
      <a href={BERKAS_APK} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-gold px-4 py-2 text-sm font-bold text-primary-900">
        <Download size={16} /> Perbarui
      </a>
    </div>
  );
}
