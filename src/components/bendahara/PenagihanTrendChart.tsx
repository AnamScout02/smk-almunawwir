"use client";

import { useId, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer } from "recharts";
import { TrendingUp, Table2 } from "lucide-react";
import { formatRupiah } from "@/lib/currency";

interface TrendPoint { month: string; label: string; terbayar: number; belumDibayar: number }

/** Palet 2-seri (kategorikal, tetap urutan: Terbayar=emerald, Belum Dibayar=amber) — sudah
 * divalidasi lolos `validate_palette.js` (skill dataviz): CVD ΔE 8.9 (protan)/27.1 (tritan),
 * normal-vision ΔE 23.8. Kontras vs surface WARN (≈2.1–2.5:1) → wajib label langsung/tabel,
 * makanya di bawah chart ada toggle "Lihat sebagai tabel" (bukan cuma warna sbg pembeda). */
const COLOR_TERBAYAR = "#10b981";
const COLOR_BELUM = "#f59e0b";

function compactRupiah(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}jt`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}rb`;
  return String(n);
}

function TooltipContent({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-lg px-3.5 py-2.5 text-xs">
      <p className="font-heading font-semibold text-primary-900 mb-1.5">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="flex items-center gap-2 text-gray-600">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          {p.name}: <strong className="text-primary-900">{formatRupiah(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

/** Grafik tren "Ringkasan Penagihan {tahun}" — Terbayar vs Belum Dibayar per bulan, dibangun
 * mengikuti skill dataviz (form = change-over-time → line chart 2 seri; warna emerald/amber
 * konsisten dgn konvensi status LUNAS/BELUM_LUNAS di §2 DESIGN_SYSTEM, bukan warna kategorikal
 * baru). Legend selalu tampil (2 seri), tooltip crosshair on-hover, + toggle tabel di bawah
 * utk aksesibilitas (identitas tidak boleh cuma dari warna — lihat WARN kontras di komentar atas). */
export default function PenagihanTrendChart({ data, year }: { data: TrendPoint[]; year: number }) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center shrink-0">
            <TrendingUp size={17} />
          </div>
          <div>
            <p className="font-heading font-semibold text-primary-900 text-sm">Ringkasan Penagihan {year}</p>
            <p className="text-xs text-gray-400">Tren Terbayar vs Belum Dibayar per bulan</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowTable(v => !v)} aria-expanded={showTable} aria-controls={tableId}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-primary-700 px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition-colors shrink-0">
          <Table2 size={13} /> {showTable ? "Sembunyikan Tabel" : "Lihat sebagai Tabel"}
        </button>
      </div>

      <div className="h-64 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={{ stroke: "#f0f0f0" }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={compactRupiah} width={48} />
            <Tooltip content={<TooltipContent />} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
            <Line type="monotone" dataKey="terbayar" name="Terbayar" stroke={COLOR_TERBAYAR} strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: COLOR_TERBAYAR }} activeDot={{ r: 5 }} />
            <Line type="monotone" dataKey="belumDibayar" name="Belum Dibayar" stroke={COLOR_BELUM} strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: COLOR_BELUM }} activeDot={{ r: 5 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showTable && (
        <div id={tableId} className="mt-4 overflow-x-auto scrollbar-visible">
          <table className="data-table">
            <thead><tr><th>Bulan</th><th className="text-right">Terbayar</th><th className="text-right">Belum Dibayar</th></tr></thead>
            <tbody>
              {data.map(d => (
                <tr key={d.month}>
                  <td>{d.label}</td>
                  <td className="text-right text-emerald-700 font-medium">{formatRupiah(d.terbayar)}</td>
                  <td className="text-right text-amber-700 font-medium">{formatRupiah(d.belumDibayar)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
