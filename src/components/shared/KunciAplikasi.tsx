"use client";
import { useEffect, useState } from "react";
import { Lock } from "lucide-react";

type Jembatan = { kunciSidikJari?: () => boolean; bisaKunci?: () => boolean; aturKunciSidikJari?: (n: boolean) => void };

/** Sakelar KUNCI APLIKASI (MyAlwis Mobile v2.5+, 5 Oktober 2026): aplikasi meminta sidik jari / wajah / PIN layar setiap
 *  kali dibuka atau kembali dari latar > 2 menit — seperti aplikasi bank. Setelannya disimpan DI HP (jembatan
 *  window.AplikasiSMK), bukan di server, karena berlaku per perangkat. Di browser & aplikasi lama kartu ini tidak tampil. */
export default function KunciAplikasi() {
  const [ada, setAda] = useState(false);
  const [nyala, setNyala] = useState(true);
  const [bisa, setBisa] = useState(true);

  useEffect(() => {
    const j = (window as unknown as { AplikasiSMK?: Jembatan }).AplikasiSMK;
    if (!j?.kunciSidikJari || !j.aturKunciSidikJari) return;
    const n = j.kunciSidikJari(), b = j.bisaKunci?.() ?? true;
    queueMicrotask(() => { setAda(true); setNyala(n); setBisa(b); });
  }, []);
  if (!ada) return null;

  const ubah = (n: boolean) => {
    (window as unknown as { AplikasiSMK: Jembatan }).AplikasiSMK.aturKunciSidikJari?.(n);
    setNyala(n);
  };

  return (
    <div className="panel p-6">
      <h3 className="font-heading font-semibold text-primary-900 flex items-center gap-2"><Lock size={18} /> Kunci aplikasi</h3>
      <label className="mt-3 flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={nyala} onChange={e => ubah(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded accent-primary-700" />
        <span className="text-sm text-gray-700">
          Minta sidik jari / wajah setiap kali aplikasi dibuka
          <span className="mt-0.5 block text-xs text-gray-500">
            Seperti aplikasi bank: orang lain yang memegang HP ini tidak bisa membuka akun Anda. Tidak diminta saat mengerjakan ujian.
          </span>
        </span>
      </label>
      {!bisa && (
        <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
          HP ini belum memakai kunci layar (sidik jari / PIN / pola). Aktifkan dulu di Setelan HP → Keamanan, baru kunci aplikasi bisa bekerja.
        </p>
      )}
    </div>
  );
}
