"use client";
import { useState } from "react";
import type { SlotJadwal } from "./JadwalHariIni";

export interface HariJadwal {
  kode: string;  // "SENIN" … "SABTU"
  label: string; // "Senin" …
  slot: SlotJadwal[];
}

/** Jadwal seminggu dalam tab per hari (bawaan: hari ini) — menggantikan daftar enam hari yang memanjang ke bawah. */
export default function JadwalMingguan({ hari, hariIni, kosong }: { hari: HariJadwal[]; hariIni: string; kosong: string }) {
  const [pilih, setPilih] = useState(() => (hari.some(h => h.kode === hariIni) ? hariIni : hari[0]?.kode ?? ""));

  if (!hari.length) {
    return <p className="rounded-xl bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">{kosong}</p>;
  }
  const aktif = hari.find(h => h.kode === pilih) ?? hari[0];

  return (
    <div>
      <div role="tablist" aria-label="Pilih hari" className="scrollbar-hide -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {hari.map(h => {
          const dipilih = h.kode === aktif.kode;
          return (
            <button key={h.kode} type="button" role="tab" aria-selected={dipilih} onClick={() => setPilih(h.kode)}
              className={`sentuh inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                dipilih ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"}`}>
              {h.label}
              {h.kode === hariIni && (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
                  <span className="sr-only">(hari ini)</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <ul role="tabpanel" aria-label={`Jadwal ${aktif.label}`} className="divide-y divide-gray-100">
        {aktif.slot.map(s => (
          <li key={s.id} className="flex items-center gap-3 py-2.5">
            <span className="angka w-[6.25rem] shrink-0 text-xs font-semibold text-gray-500">{s.mulai}–{s.selesai}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary-900">{s.judul}</span>
            {s.keterangan && (
              <span className="max-w-[40%] shrink-0 truncate rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">{s.keterangan}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
