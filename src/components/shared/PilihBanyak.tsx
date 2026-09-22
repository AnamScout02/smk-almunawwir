"use client";
import { useState } from "react";
import { Search } from "lucide-react";

/** Pilihan banyak sederhana: chip yang bisa diketuk + kotak cari bila opsi banyak. */
export default function PilihBanyak({ label, opsi, nilai, onChange }: { label: string; opsi: { value: string; label: string }[]; nilai: string[]; onChange: (v: string[]) => void }) {
  const [cari, setCari] = useState("");
  const pilih = new Set(nilai);
  const tampil = opsi.filter(o => !cari || o.label.toLowerCase().includes(cari.toLowerCase()));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="label-field mb-0">{label}</span>
        {nilai.length > 0 && <button type="button" onClick={() => onChange([])} className="text-xs font-medium text-primary-700 hover:underline">Kosongkan ({nilai.length})</button>}
      </div>
      {opsi.length > 12 && (
        <div className="relative mb-2">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari…" className="input-field pl-10" aria-label={`Cari ${label}`} />
        </div>
      )}
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-xl border border-gray-100 p-2">
        {tampil.map(o => {
          const on = pilih.has(o.value);
          return (
            <button key={o.value} type="button" aria-pressed={on}
              onClick={() => onChange(on ? nilai.filter(v => v !== o.value) : [...nilai, o.value])}
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${on ? "border-primary-900 bg-primary-900 text-white" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              {o.label}
            </button>
          );
        })}
        {tampil.length === 0 && <span className="px-1 text-xs text-gray-400">Tidak ada pilihan.</span>}
      </div>
    </div>
  );
}
