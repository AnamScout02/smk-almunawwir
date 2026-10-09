"use client";
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { WilayahPeta } from "@/lib/peta-batas";

/** PETA PERSAINGAN (9 Oktober 2026) — satu kabupaten per kecamatan, dua lapis sekaligus:
 *  warna kecamatan = POTENSI lawan SERAPAN (banyak lulusan & sudah masuk ke kita / banyak lulusan tetapi belum),
 *  titik = sekolah (SMP/MTs sasaran dan sekolah lanjutan), besar titik menurut jumlah siswanya. */
export type KecPeta = { nama: string; lulusan: number; kita: number; kursi: number };
export type TitikPeta = { id: string; nama: string; jenis: "smp" | "lanjutan" | "kita"; n: number; lat: number; lng: number; ket: string };

const WARNA = { peluang: "#f59e0b", kuat: "#15803d", terserap: "#86efac", kecil: "#e5e7eb" } as const;
const LABEL: Record<keyof typeof WARNA, string> = {
  peluang: "Lulusan banyak, belum masuk ke kita", kuat: "Lulusan banyak, sudah masuk ke kita",
  terserap: "Lulusan sedikit, sudah masuk ke kita", kecil: "Lulusan sedikit / belum ada data",
};
const rapi = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function PetaPersaingan({ kodeKab, kec, titik }: { kodeKab: string; kec: KecPeta[]; titik: TitikPeta[] }) {
  const [batas, setBatas] = useState<WilayahPeta[] | null>(null);
  const [gagal, setGagal] = useState(false);
  const [lapis, setLapis] = useState({ smp: true, lanjutan: true });
  const [pilih, setPilih] = useState<{ judul: string; isi: string } | null>(null);
  useEffect(() => {
    let hidup = true;
    fetch(`/data/peta/kec/${kodeKab}.json`).then(r => (r.ok ? r.json() : Promise.reject())).then(d => { if (hidup) setBatas(d); }).catch(() => { if (hidup) setGagal(true); });
    return () => { hidup = false; };
  }, [kodeKab]);

  const perKec = useMemo(() => new Map(kec.map(k => [rapi(k.nama), k])), [kec]);
  const median = useMemo(() => { const v = kec.map(k => k.lulusan).filter(x => x > 0).sort((a, b) => a - b); return v[Math.floor(v.length / 2)] ?? 0; }, [kec]);
  const golongan = (k?: KecPeta): keyof typeof WARNA => {
    if (!k || !k.lulusan) return "kecil";
    const terserap = k.kita / k.lulusan >= 0.02; // ≥2% lulusan kecamatan itu masuk ke kita tiap tahun
    return k.lulusan >= median ? (terserap ? "kuat" : "peluang") : terserap ? "terserap" : "kecil";
  };
  const kotak = useMemo(() => {
    if (!batas?.length) return null;
    let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const w of batas) { a = Math.min(a, w.b[0]); b = Math.min(b, w.b[1]); c = Math.max(c, w.b[2]); d = Math.max(d, w.b[3]); }
    return { x: a, y: b, w: c - a, h: d - b };
  }, [batas]);

  if (gagal) return <p className="text-sm text-gray-400">Batas kecamatan kabupaten ini belum tersedia, jadi petanya tidak bisa digambar. Tabel di bawah tetap lengkap.</p>;
  if (!batas || !kotak) return <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const u = Math.max(kotak.w, kotak.h) / 600;
  const maks = Math.max(1, ...titik.map(t => t.n));
  const jari = (n: number) => (2.5 + 9 * Math.sqrt(n / maks)) * u;
  const tampil = titik.filter(t => t.jenis === "kita" || lapis[t.jenis]).sort((x, y) => y.n - x.n);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <div className="min-w-0 xl:col-span-8">
        <svg viewBox={`${kotak.x - 6 * u} ${kotak.y - 6 * u} ${kotak.w + 12 * u} ${kotak.h + 12 * u}`} className="block max-h-[70dvh] w-full rounded-xl border border-gray-100 bg-[#f5f6fa]" role="img" aria-label="Peta potensi, serapan, dan sekolah">
          {batas.map(w => {
            const k = perKec.get(rapi(w.n));
            return (
              <path key={w.k} d={w.d} fill={WARNA[golongan(k)]} stroke="#ffffff" strokeWidth={1.1 * u} strokeLinejoin="round" className="cursor-pointer"
                onClick={() => setPilih({ judul: `Kecamatan ${w.n}`, isi: k ? `Lulusan SMP/MTs (kelas IX): ${k.lulusan.toLocaleString("id-ID")} · masuk ke kita ±${k.kita.toLocaleString("id-ID")}/tahun · kelas X di sekolah lanjutan setempat: ${k.kursi.toLocaleString("id-ID")}` : "Belum ada data sekolah di kecamatan ini." })}>
                <title>{w.n}</title>
              </path>
            );
          })}
          {tampil.map(t => (
            <circle key={t.id} cx={t.lng} cy={-t.lat} r={t.jenis === "kita" ? 7 * u : jari(t.n)} className="cursor-pointer"
              fill={t.jenis === "kita" ? "#E8A020" : t.jenis === "smp" ? "#1B2B6B" : "#dc2626"} fillOpacity={t.jenis === "kita" ? 1 : 0.72}
              stroke="#ffffff" strokeWidth={(t.jenis === "kita" ? 2 : 0.8) * u} onClick={() => setPilih({ judul: t.nama, isi: t.ket })}>
              <title>{t.nama}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="min-w-0 space-y-4 xl:col-span-4">
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="label-kecil mb-2">Warna kecamatan</p>
          <ul className="space-y-1.5 text-xs text-gray-600">
            {(Object.keys(WARNA) as (keyof typeof WARNA)[]).map(g => (
              <li key={g} className="flex items-center gap-2"><span className="h-3.5 w-3.5 shrink-0 rounded" style={{ background: WARNA[g] }} />{LABEL[g]}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">&ldquo;Banyak&rdquo; = di atas nilai tengah kecamatan ({median.toLocaleString("id-ID")} lulusan). &ldquo;Sudah masuk&rdquo; = sedikitnya 2% lulusannya masuk ke kita tiap tahun.</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="label-kecil mb-2">Titik sekolah</p>
          <div className="space-y-2 text-xs text-gray-600">
            <label className="flex items-center gap-2"><input type="checkbox" checked={lapis.smp} onChange={e => setLapis(l => ({ ...l, smp: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" /><span className="h-3 w-3 rounded-full bg-primary-700" /> SMP & MTs (besar = kelas IX)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={lapis.lanjutan} onChange={e => setLapis(l => ({ ...l, lanjutan: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" /><span className="h-3 w-3 rounded-full bg-red-600" /> SMK, SMA & MA lain (besar = kelas X)</label>
            <p className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-gold ring-2 ring-white" /> Sekolah kita</p>
          </div>
        </div>
        <div className="rounded-xl border border-gold/40 bg-amber-50/50 p-4 text-sm">
          {pilih ? (<><p className="font-heading font-semibold text-navy">{pilih.judul}</p><p className="mt-1 text-xs text-gray-600">{pilih.isi}</p></>) : <p className="text-xs text-gray-500">Ketuk kecamatan atau titik sekolah untuk melihat angkanya.</p>}
        </div>
      </div>
    </div>
  );
}
