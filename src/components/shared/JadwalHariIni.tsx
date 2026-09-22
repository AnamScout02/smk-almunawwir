"use client";
import { useEffect, useState } from "react";

export interface SlotJadwal {
  id: string;
  mulai: string;   // "HH:MM"
  selesai: string; // "HH:MM"
  judul: string;
  keterangan?: string;
}

const keMenit = (jam: string) => {
  const [h, m] = jam.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
/** Menit sejak tengah malam WIB — server berjalan di UTC dan HP pengguna bisa berzona waktu lain. */
const menitWib = () => {
  const w = new Date(Date.now() + 7 * 3600_000);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
};
const lama = (menit: number) => {
  if (menit < 60) return `${menit} menit`;
  const j = Math.floor(menit / 60), m = menit % 60;
  return m ? `${j} jam ${m} menit` : `${j} jam`;
};

/** Garis waktu jadwal hari ini: pelajaran yang SEDANG berlangsung disorot (dengan kemajuan jam), yang berikutnya
 * ditandai, yang sudah lewat diredupkan. Diperbarui tiap 30 detik tanpa memuat ulang halaman. Status baru dihitung
 * setelah terpasang di browser supaya render server & klien sama (tidak ada galat hydration). */
export default function JadwalHariIni({ slot, kosong }: { slot: SlotJadwal[]; kosong: string }) {
  const [kini, setKini] = useState<number | null>(null);

  useEffect(() => {
    const perbarui = () => setKini(menitWib());
    perbarui();
    const t = setInterval(perbarui, 30_000);
    return () => clearInterval(t);
  }, []);

  if (!slot.length) {
    return <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">{kosong}</p>;
  }

  const urut = [...slot].sort((a, b) => keMenit(a.mulai) - keMenit(b.mulai));
  const berlangsung = kini === null ? undefined : urut.find(s => kini >= keMenit(s.mulai) && kini < keMenit(s.selesai));
  const berikutnya = kini === null ? undefined : urut.find(s => keMenit(s.mulai) > kini);

  let ringkasan = "";
  if (kini !== null) {
    if (berlangsung) ringkasan = `Sedang berlangsung: ${berlangsung.judul} — selesai pukul ${berlangsung.selesai}.`;
    else if (berikutnya) {
      const sisa = lama(keMenit(berikutnya.mulai) - kini);
      ringkasan = kini < keMenit(urut[0].mulai)
        ? `Dimulai pukul ${berikutnya.mulai} (${sisa} lagi).`
        : `Berikutnya pukul ${berikutnya.mulai}: ${berikutnya.judul} (${sisa} lagi).`;
    } else ringkasan = "Semua jadwal hari ini sudah selesai.";
  }

  return (
    <div>
      <p className="mb-4 min-h-5 text-sm text-gray-600" aria-live="polite">{ringkasan}</p>
      <ol>
        {urut.map((s, i) => {
          const mulai = keMenit(s.mulai), selesai = keMenit(s.selesai);
          const status = kini === null ? "nanti"
            : kini >= selesai ? "selesai"
            : kini >= mulai ? "berlangsung"
            : s === berikutnya ? "berikutnya" : "nanti";
          const persen = status === "berlangsung" && kini !== null
            ? Math.min(100, Math.round(((kini - mulai) / Math.max(1, selesai - mulai)) * 100)) : 0;
          const aktif = status === "berlangsung";
          return (
            <li key={s.id} className="flex gap-3">
              <div className="flex w-3 flex-col items-center" aria-hidden="true">
                <span className={`mt-4 h-3 w-3 shrink-0 rounded-full border-2 ${
                  aktif ? "border-gold bg-gold ring-4 ring-gold/20"
                  : status === "berikutnya" ? "border-primary-700 bg-white"
                  : status === "selesai" ? "border-gray-300 bg-gray-300" : "border-gray-300 bg-white"}`} />
                {i < urut.length - 1 && <span className="w-px flex-1 bg-gray-200" />}
              </div>
              <div className={`mb-2 min-w-0 flex-1 rounded-xl px-3.5 py-2.5 transition-colors ${
                aktif ? "bg-primary-900 shadow-panel-naik" : status === "berikutnya" ? "bg-primary-50" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className={`angka text-xs font-semibold ${aktif ? "text-gold" : status === "selesai" ? "text-gray-400" : "text-gray-500"}`}>
                    {s.mulai}–{s.selesai}
                  </p>
                  {aktif && <span className="rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-primary-900">Berlangsung</span>}
                  {status === "berikutnya" && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-primary-700 ring-1 ring-primary-100">Berikutnya</span>}
                </div>
                <p className={`mt-0.5 truncate text-sm font-semibold ${aktif ? "text-white" : status === "selesai" ? "text-gray-400" : "text-primary-900"}`}>
                  {s.judul}
                </p>
                {s.keterangan && (
                  <p className={`truncate text-xs ${aktif ? "text-white/70" : "text-gray-500"}`}>{s.keterangan}</p>
                )}
                {aktif && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Kemajuan jam pelajaran"
                    aria-valuenow={persen} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-gold" style={{ width: `${persen}%` }} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
