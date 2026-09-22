import React from "react";

/** Grafik ringkas tanpa pustaka (HTML + CSS + SVG) — Pola tampilan v2 (DESIGN_SYSTEM.md §17).
 * Tajam di semua ukuran layar, tidak perlu JavaScript, dan angka selalu tertulis langsung (tidak bergantung warna/hover). */

/** Batang per kategori (mis. siswa per jurusan). `warna` per baris opsional — mis. warna jurusan dari data Major. */
export function BarDaftar({ data, satuan }: {
  data: { kunci: string; label: string; sublabel?: string; nilai: number; warna?: string }[];
  satuan?: string;
}) {
  const maks = Math.max(1, ...data.map(d => d.nilai));
  return (
    <ul className="min-w-0 space-y-3.5">
      {data.map(d => (
        <li key={d.kunci} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex min-w-0 items-center gap-2 text-sm">
              {d.warna && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.warna }} aria-hidden="true" />}
              <span className="min-w-0 truncate">
                <span className="font-semibold text-primary-900">{d.label}</span>
                {d.sublabel && <span className="text-gray-500"> · {d.sublabel}</span>}
              </span>
            </p>
            <p className="angka shrink-0 text-sm font-semibold text-primary-900">
              {d.nilai.toLocaleString("id-ID")}
              {satuan && <span className="ml-1 text-xs font-normal text-gray-500">{satuan}</span>}
            </p>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
            <div className="bar-tumbuh h-full rounded-full" style={{ width: `${(d.nilai / maks) * 100}%`, background: d.warna ?? "var(--color-primary-700)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Donat komposisi (mis. siswa L/P) — total di tengah, celah tipis antarbagian, keterangan angka + persen di bawah. */
export function DonatBagian({ judul, bagian, satuan }: {
  judul: string;
  bagian: { label: string; nilai: number; warna: string }[];
  satuan?: string;
}) {
  const total = bagian.reduce((a, b) => a + b.nilai, 0);
  const r = 42;
  const keliling = 2 * Math.PI * r;
  const berisi = bagian.filter(b => b.nilai > 0);
  const celah = berisi.length > 1 ? 2.5 : 0;
  let geser = 0;
  const segmen = berisi.map(b => {
    const panjang = (b.nilai / total) * keliling;
    const s = { ...b, garis: Math.max(0, panjang - celah), geser };
    geser += panjang;
    return s;
  });
  return (
    <figure className="flex min-w-0 flex-col items-center gap-3">
      <figcaption className="text-center text-sm font-medium text-gray-600">{judul}</figcaption>
      <div className="relative h-28 w-28 sm:h-32 sm:w-32">
        <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img"
          aria-label={`${judul}: ${bagian.map(b => `${b.label} ${b.nilai}`).join(", ")}`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="#eef0f4" strokeWidth="11" />
          {segmen.map(s => (
            <circle key={s.label} cx="50" cy="50" r={r} fill="none" stroke={s.warna} strokeWidth="11"
              className="donat-seg" style={{ strokeDasharray: `${s.garis} ${keliling}`, strokeDashoffset: -s.geser }} />
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="angka font-heading text-2xl font-bold leading-none text-primary-900">{total.toLocaleString("id-ID")}</span>
          {satuan && <span className="mt-1 text-xs text-gray-500">{satuan}</span>}
        </div>
      </div>
      <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {bagian.map(b => (
          <li key={b.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.warna }} aria-hidden="true" />
            {b.label}
            <span className="angka font-semibold text-primary-900">{b.nilai.toLocaleString("id-ID")}</span>
            {total > 0 && <span className="angka text-gray-400">({Math.round((b.nilai / total) * 100)}%)</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Batang bertumpuk satu baris (mis. status kehadiran bulan ini) + keterangan angka & persen. */
export function BagianBar({ judul, bagian, satuan }: {
  judul?: string;
  bagian: { label: string; nilai: number; warna: string }[];
  satuan?: string;
}) {
  const total = bagian.reduce((a, b) => a + b.nilai, 0);
  return (
    <div className="min-w-0">
      {judul && (
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-gray-600">{judul}</p>
          <p className="angka text-sm font-semibold text-primary-900">
            {total.toLocaleString("id-ID")}
            {satuan && <span className="ml-1 text-xs font-normal text-gray-500">{satuan}</span>}
          </p>
        </div>
      )}
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-gray-100" role="img"
        aria-label={bagian.map(b => `${b.label} ${b.nilai}`).join(", ")}>
        {total > 0 && bagian.filter(b => b.nilai > 0).map(b => (
          <div key={b.label} className="bar-bagian h-full basis-0" style={{ flexGrow: b.nilai, background: b.warna }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {bagian.map(b => (
          <li key={b.label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: b.warna }} aria-hidden="true" />
            {b.label}
            <span className="angka font-semibold text-primary-900">{b.nilai.toLocaleString("id-ID")}</span>
            {total > 0 && <span className="angka text-gray-400">({Math.round((b.nilai / total) * 100)}%)</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
