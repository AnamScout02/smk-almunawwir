"use client";
import { useMemo, useState } from "react";

interface Simpul { id: string; nama: string; dipilih: number; mengisi: boolean }
const L = 820, T = 560;
const pendek = (n: string) => { const k = n.trim().split(/\s+/); return (k.length > 2 ? `${k[0]} ${k[1]}` : n).slice(0, 18); };

/** Tata letak gaya-pegas sederhana (Fruchterman–Reingold), DETERMINISTIK: posisi awal di lingkaran menurut urutan,
 *  tanpa bilangan acak — hasilnya sama tiap dibuka, jadi guru BK bisa membandingkan tangkapan layar antar waktu. */
function tataLetak(simpul: Simpul[], sisi: [string, string][]) {
  const n = simpul.length, idx = new Map(simpul.map((s, i) => [s.id, i]));
  const x = simpul.map((_, i) => L / 2 + Math.cos((2 * Math.PI * i) / n) * (L * 0.36));
  const y = simpul.map((_, i) => T / 2 + Math.sin((2 * Math.PI * i) / n) * (T * 0.36));
  const pasangan = sisi.map(([a, b]) => [idx.get(a), idx.get(b)] as const).filter((p): p is readonly [number, number] => p[0] != null && p[1] != null && p[0] !== p[1]);
  const k = Math.sqrt((L * T) / Math.max(n, 1)) * 0.75;
  for (let langkah = 0; langkah < 260; langkah++) {
    const dx = new Array<number>(n).fill(0), dy = new Array<number>(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const ax = x[i] - x[j], ay = y[i] - y[j], d = Math.max(Math.hypot(ax, ay), 1), f = (k * k) / d;
      dx[i] += (ax / d) * f; dy[i] += (ay / d) * f; dx[j] -= (ax / d) * f; dy[j] -= (ay / d) * f;
    }
    for (const [a, b] of pasangan) {
      const ax = x[a] - x[b], ay = y[a] - y[b], d = Math.max(Math.hypot(ax, ay), 1), f = (d * d) / k;
      dx[a] -= (ax / d) * f; dy[a] -= (ay / d) * f; dx[b] += (ax / d) * f; dy[b] += (ay / d) * f;
    }
    const suhu = 28 * (1 - langkah / 260) + 1;
    for (let i = 0; i < n; i++) {
      // Tarikan lembut ke tengah supaya siswa tanpa hubungan tidak terlempar ke sudut.
      dx[i] += (L / 2 - x[i]) * 0.06; dy[i] += (T / 2 - y[i]) * 0.06;
      const d = Math.max(Math.hypot(dx[i], dy[i]), 1), g = Math.min(d, suhu);
      x[i] = Math.min(L - 46, Math.max(46, x[i] + (dx[i] / d) * g)); y[i] = Math.min(T - 34, Math.max(26, y[i] + (dy[i] / d) * g));
    }
  }
  return { x, y, idx };
}

/** PETA PERTEMANAN KELAS dari angket sosiometri (11 Okt 2026). Panah = "memilih"; garis hijau tebal = saling memilih;
 *  lingkaran makin besar = makin sering dipilih; merah = tidak dipilih siapa pun; bergaris putus = belum mengisi angket.
 *  Ketuk satu siswa untuk menyorot hubungannya. Rahasia — hanya tampil di layar hasil yang memang dibatasi server. */
export default function GrafSosiometri({ siswa, pilihan }: { siswa: Simpul[]; pilihan: [string, string][] }) {
  const [sorot, setSorot] = useState<string | null>(null);
  const { x, y, idx } = useMemo(() => tataLetak(siswa, pilihan), [siswa, pilihan]);
  const kunci = useMemo(() => new Set(pilihan.map(([a, b]) => `${a}>${b}`)), [pilihan]);
  const maks = Math.max(1, ...siswa.map(s => s.dipilih));
  const r = (s: Simpul) => 9 + (s.dipilih / maks) * 13;
  if (siswa.length === 0) return null;
  const terkait = sorot ? new Set([sorot, ...pilihan.filter(([a, b]) => a === sorot || b === sorot).flat()]) : null;
  return (
    <div>
      <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
        <svg viewBox={`0 0 ${L} ${T}`} className="h-auto w-full min-w-[640px]" role="img" aria-label="Peta pertemanan kelas dari angket sosiometri">
          <defs>
            <marker id="panah-sosio" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#94a3b8" /></marker>
            <marker id="panah-sosio-kuat" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#1B2B6B" /></marker>
          </defs>
          {pilihan.map(([a, b], i) => {
            const ia = idx.get(a), ib = idx.get(b);
            if (ia == null || ib == null) return null;
            const timbal = kunci.has(`${b}>${a}`);
            if (timbal && a > b) return null; // pasangan saling memilih digambar sekali
            const ax = x[ia], ay = y[ia], bx = x[ib], by = y[ib], d = Math.max(Math.hypot(bx - ax, by - ay), 1);
            const ra = r(siswa[ia]) + 2, rb = r(siswa[ib]) + (timbal ? 2 : 5);
            const redup = terkait && !(a === sorot || b === sorot);
            const tebal = sorot && (a === sorot || b === sorot);
            return <line key={i} x1={ax + ((bx - ax) / d) * ra} y1={ay + ((by - ay) / d) * ra} x2={bx - ((bx - ax) / d) * rb} y2={by - ((by - ay) / d) * rb}
              stroke={timbal ? "#059669" : tebal ? "#1B2B6B" : "#94a3b8"} strokeWidth={timbal ? 2.6 : tebal ? 1.8 : 1.1} opacity={redup ? 0.12 : timbal ? 0.9 : 0.7}
              markerEnd={timbal ? undefined : `url(#${tebal ? "panah-sosio-kuat" : "panah-sosio"})`} />;
          })}
          {siswa.map((s, i) => {
            const redup = terkait && !terkait.has(s.id);
            return (
              <g key={s.id} opacity={redup ? 0.25 : 1} onClick={() => setSorot(sorot === s.id ? null : s.id)} className="cursor-pointer">
                <title>{`${s.nama} — dipilih ${s.dipilih} kali${s.mengisi ? "" : ", belum mengisi angket"}`}</title>
                <circle cx={x[i]} cy={y[i]} r={r(s)} fill={s.dipilih === 0 ? "#fee2e2" : "#EEF0F8"} stroke={s.dipilih === 0 ? "#dc2626" : "#1B2B6B"} strokeWidth={sorot === s.id ? 3 : 1.6} strokeDasharray={s.mengisi ? undefined : "3 3"} />
                <text x={x[i]} y={y[i] + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill={s.dipilih === 0 ? "#b91c1c" : "#0F1A45"}>{s.dipilih}</text>
                <text x={x[i]} y={y[i] + r(s) + 13} textAnchor="middle" fontSize="12" fill="#374151" stroke="#fff" strokeWidth="3" paintOrder="stroke">{pendek(s.nama)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Angka di lingkaran = berapa kali dipilih. <span className="font-semibold text-emerald-700">Garis hijau</span> = saling memilih, panah abu = memilih satu arah,
        <span className="font-semibold text-red-600"> lingkaran merah</span> = tidak dipilih siapa pun, garis putus-putus = belum mengisi angket. Ketuk satu siswa untuk menyorot hubungannya.
      </p>
    </div>
  );
}
