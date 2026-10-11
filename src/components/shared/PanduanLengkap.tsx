"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { ALUR, keterangan, type PortalPanduan } from "@/lib/panduan-fitur";
import type { GrupMenuKisi } from "@/components/shared/MenuLengkap";

/** PANDUAN PER PERAN (11 Okt 2026) — memakai GRUP MENU YANG SAMA dengan sidebar & kisi menu (sudah disaring peran dan
 *  jabatan), jadi yang dijelaskan persis fitur yang memang dimiliki akun ini. Keterangan & alur kerja dari
 *  src/lib/panduan-fitur.ts. */
export default function PanduanLengkap({ grup, portal }: { grup: GrupMenuKisi[]; portal: PortalPanduan }) {
  const [cari, setCari] = useState("");
  const q = cari.trim().toLowerCase();
  const alur = ALUR.filter(a => a.untuk.includes(portal));
  const tampil = useMemo(() => grup.map(g => ({
    label: g.label, items: g.items.map(i => ({ ...i, ket: keterangan(i.label, portal) })).filter(i => !q || `${i.label} ${i.ket}`.toLowerCase().includes(q)),
  })).filter(g => g.items.length > 0), [grup, portal, q]);
  const jumlah = grup.reduce((n, g) => n + g.items.length, 0);
  return (
    <div className="space-y-6">
      <div className="baris-alat">
        <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari fitur, mis. izin, rapor, jurnal…" className="input-field pl-10" /></div>
      </div>
      {!q && alur.length > 0 && (
        <section className="panel overflow-hidden">
          <div className="panel-kepala"><p className="panel-judul">Alur kerja</p><span className="text-xs text-gray-500">ketuk untuk membuka</span></div>
          <div className="divide-y divide-gray-100">
            {alur.map((a, i) => (
              <details key={a.peran} className="px-4 py-3 sm:px-5" open={alur.length === 1 && i === 0}>
                <summary className="cursor-pointer text-sm font-semibold text-primary-900">{a.peran}</summary>
                <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-gray-700">{a.langkah.map(l => <li key={l}>{l}</li>)}</ol>
              </details>
            ))}
          </div>
        </section>
      )}
      {tampil.length === 0 ? <div className="panel"><p className="py-10 text-center text-sm text-gray-400">Tidak ada fitur yang cocok dengan pencarian.</p></div> : tampil.map(g => (
        <section key={g.label ?? "utama"} className="panel overflow-hidden">
          <div className="panel-kepala"><p className="panel-judul">{g.label ?? "Utama"}</p><span className="angka text-xs text-gray-500">{g.items.length} fitur</span></div>
          <ul className="divide-y divide-gray-100">
            {g.items.map(i => (
              <li key={i.href}>
                <Link href={i.href} className="flex items-start gap-3 px-4 py-3 transition hover:bg-gray-50 sm:px-5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700"><i.icon size={16} /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-primary-900">{i.label}</span><span className="block text-sm text-gray-600">{i.ket || "Buka menunya untuk melihat isinya."}</span></span>
                  <ChevronRight size={16} className="mt-1 shrink-0 text-gray-300" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <p className="text-xs text-gray-500">Menampilkan <span className="angka">{jumlah}</span> fitur yang tersedia untuk akun Anda. Jabatan yang berbeda melihat daftar yang berbeda.</p>
    </div>
  );
}
