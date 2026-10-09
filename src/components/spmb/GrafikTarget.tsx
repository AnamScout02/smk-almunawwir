import type { TargetGelombang } from "@/lib/spmb-target";

/** Grafik garis Target vs Capaian satu gelombang — SVG server murni (tanpa pustaka grafik). Capaian = garis navy
 *  sampai hari ini, ideal = garis putus-putus abu menuju target, tahun lalu = garis putus-putus emas bila ada. */
export default function GrafikTarget({ g }: { g: TargetGelombang }) {
  const W = 640, H = 200, kiri = 34, bawah = 22, atas = 10, kanan = 10;
  const maks = Math.max(1, g.target, ...g.deret.map(d => Math.max(d.kumulatif ?? 0, d.tahunLalu ?? 0)));
  const x = (i: number) => kiri + (g.deret.length > 1 ? (i / (g.deret.length - 1)) * (W - kiri - kanan) : 0);
  const y = (v: number) => atas + (1 - v / maks) * (H - atas - bawah);
  const garis = (nilai: (d: TargetGelombang["deret"][number]) => number | null) =>
    g.deret.map((d, i) => ({ v: nilai(d), i })).filter(p => p.v !== null)
      .map((p, j) => `${j ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v as number).toFixed(1)}`).join(" ");
  const tglPendek = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });
  const garisY = [0, 0.5, 1].map(f => Math.round(maks * f));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Grafik target ${g.nama}`}>
      {garisY.map(v => (
        <g key={v}>
          <line x1={kiri} x2={W - kanan} y1={y(v)} y2={y(v)} stroke="#eef0f4" />
          <text x={kiri - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#9ca3af">{v}</text>
        </g>
      ))}
      <text x={kiri} y={H - 4} fontSize="11" fill="#9ca3af">{tglPendek(g.deret[0].tanggal)}</text>
      <text x={W - kanan} y={H - 4} textAnchor="end" fontSize="11" fill="#9ca3af">{tglPendek(g.deret[g.deret.length - 1].tanggal)}</text>
      {g.target > 0 && <path d={garis(d => d.ideal)} fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="5 4" />}
      {g.tahunLaluTotal !== null && <path d={garis(d => d.tahunLalu)} fill="none" stroke="#E8A020" strokeWidth="1.8" strokeDasharray="3 3" />}
      <path d={garis(d => d.kumulatif)} fill="none" stroke="#1B2B6B" strokeWidth="2.5" strokeLinejoin="round" />
      {g.hariBerjalan > 0 && g.hariBerjalan <= g.deret.length && (
        <circle cx={x(g.hariBerjalan - 1)} cy={y(g.deret[g.hariBerjalan - 1].kumulatif ?? 0)} r="4" fill="#1B2B6B" />
      )}
    </svg>
  );
}
