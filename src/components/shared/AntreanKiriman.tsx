"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CloudOff, Loader2 } from "lucide-react";
import { useToast } from "@/components/shared/ToastProvider";
import { daftarKiriman, kirimSemuaAntrean, PERISTIWA_ANTREAN } from "@/lib/antrean-kirim";

/** Penjaga ANTREAN KIRIM (src/lib/antrean-kirim.ts) — dipasang sekali di layout portal guru. Mencoba mengirim saat halaman
 *  dibuka, saat sinyal kembali, dan tiap 45 detik selama masih ada antrean; menampilkan pil kecil "N isian menunggu sinyal". */
export default function AntreanKiriman() {
  const toast = useToast();
  const [jumlah, setJumlah] = useState(0);
  const [sibuk, setSibuk] = useState(false);
  const jalan = useRef(false);

  const hitung = useCallback(() => { daftarKiriman().then(d => setJumlah(d.length)); }, []);
  const coba = useCallback(async () => {
    if (jalan.current) return;
    if ((await daftarKiriman()).length === 0) { setJumlah(0); return; }
    jalan.current = true; setSibuk(true);
    const h = await kirimSemuaAntrean().catch(() => null);
    jalan.current = false; setSibuk(false);
    if (h?.terkirim.length) toast.success(`Terkirim setelah sinyal kembali: ${h.terkirim.slice(0, 3).join("; ")}${h.terkirim.length > 3 ? ` dan ${h.terkirim.length - 3} lainnya` : ""}.`);
    for (const d of h?.ditolak ?? []) toast.error(`${d.label} tidak tersimpan: ${d.pesan}`);
    hitung();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hitung]);

  useEffect(() => {
    coba();
    const berubah = () => hitung();
    window.addEventListener("online", coba);
    window.addEventListener(PERISTIWA_ANTREAN, berubah);
    const t = setInterval(coba, 45_000);
    return () => { window.removeEventListener("online", coba); window.removeEventListener(PERISTIWA_ANTREAN, berubah); clearInterval(t); };
  }, [coba, hitung]);

  if (jumlah === 0) return null;
  return (
    <button type="button" onClick={coba} disabled={sibuk} title="Ketuk untuk mencoba mengirim sekarang"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-50 flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs font-semibold text-amber-800 shadow-panel-naik print:hidden lg:bottom-6 lg:left-auto lg:right-40">
      {sibuk ? <Loader2 size={14} className="animate-spin" /> : <CloudOff size={14} />}
      {jumlah} isian menunggu sinyal
    </button>
  );
}
