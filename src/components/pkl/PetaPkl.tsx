"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Map as IkonPeta, Loader2, MapPinOff, Building2, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import type { WilayahPeta } from "@/lib/peta-batas";

type Titik = { id: string; nama: string; lat: number; lng: number; kuota: number | null; siswa: number; kecamatan: string | null; kabupaten: string | null; bidang: string | null; mou: string };
type Data = { titik: Titik[]; tanpaTitik: { id: string; nama: string; siswa: number }[] };
/** Titik sekolah (sama dengan Peta Persaingan) dan kabupaten bawaan peta: Banyuwangi. */
const KITA = { lat: -8.2907167, lng: 114.2072342 }, KAB = "35.10";

/** PETA PKL (9 Okt 2026) — sebaran DUDI di atas batas kecamatan; besar lingkaran = jumlah siswa yang sedang PKL di sana.
 *  DUDI di luar kabupaten tetap dihitung, tetapi didaftar di samping peta (petanya satu kabupaten supaya terbaca). */
export default function PetaPkl() {
  const [d, setD] = useState<Data | null>(null);
  const [batas, setBatas] = useState<WilayahPeta[] | null>(null);
  const [pilih, setPilih] = useState<Titik | null>(null);
  useEffect(() => {
    fetch("/api/pkl/peta").then(r => r.json()).then(x => setD(x.titik ? x : { titik: [], tanpaTitik: [] })).catch(() => setD({ titik: [], tanpaTitik: [] }));
    fetch(`/data/peta/kec/${KAB}.json`).then(r => (r.ok ? r.json() : [])).then(setBatas).catch(() => setBatas([]));
  }, []);
  const kotak = useMemo(() => {
    if (!batas?.length) return null;
    let [a, b, c, e] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const w of batas) { a = Math.min(a, w.b[0]); b = Math.min(b, w.b[1]); c = Math.max(c, w.b[2]); e = Math.max(e, w.b[3]); }
    return { x: a, y: b, w: c - a, h: e - b };
  }, [batas]);
  if (!d || !batas) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const dalam = (t: Titik) => !!kotak && t.lng >= kotak.x && t.lng <= kotak.x + kotak.w && -t.lat >= kotak.y && -t.lat <= kotak.y + kotak.h;
  const diPeta = d.titik.filter(dalam).sort((a, b) => b.siswa - a.siswa), luar = d.titik.filter(t => !dalam(t));
  const u = kotak ? Math.max(kotak.w, kotak.h) / 600 : 1;
  const maks = Math.max(1, ...d.titik.map(t => t.siswa));
  const jarak = (t: Titik) => { const r = (x: number) => (x * Math.PI) / 180; const a = Math.sin(r(t.lat - KITA.lat) / 2) ** 2 + Math.cos(r(KITA.lat)) * Math.cos(r(t.lat)) * Math.sin(r(t.lng - KITA.lng) / 2) ** 2; return Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * 10) / 10; };
  const warna = (t: Titik) => (t.kuota != null && t.siswa >= t.kuota ? "#d97706" : t.siswa > 0 ? "#1B2B6B" : "#94a3b8");
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<IkonPeta size={22} />} title="Peta PKL" description="Sebaran tempat PKL dan jumlah siswa yang sedang PKL di tiap DUDI" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={d.titik.length} label="DUDI bertitik lokasi" icon={Building2} color="primary" />
          <StatTile value={d.titik.reduce((a, t) => a + t.siswa, 0)} label="Siswa di DUDI bertitik" icon={Users} color="blue" />
          <StatTile value={d.tanpaTitik.length} label="DUDI tanpa titik lokasi" icon={MapPinOff} color="amber" sorot={d.tanpaTitik.length > 0} />
        </div>
        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
          <div className="panel min-w-0 p-4 xl:col-span-8">
            {!kotak ? <p className="py-10 text-center text-sm text-gray-400">Batas kecamatan belum tersedia, jadi peta tidak bisa digambar. Daftar di samping tetap lengkap.</p> : (
              <svg viewBox={`${kotak.x - 6 * u} ${kotak.y - 6 * u} ${kotak.w + 12 * u} ${kotak.h + 12 * u}`} className="block max-h-[72dvh] w-full rounded-xl border border-gray-100 bg-[#f5f6fa]" role="img" aria-label="Peta sebaran tempat PKL">
                {batas.map(w => <path key={w.k} d={w.d} fill="#e8ebf5" stroke="#ffffff" strokeWidth={1.1 * u} strokeLinejoin="round"><title>{w.n}</title></path>)}
                <circle cx={KITA.lng} cy={-KITA.lat} r={6 * u} fill="#E8A020" stroke="#ffffff" strokeWidth={2 * u}><title>Sekolah</title></circle>
                {diPeta.map(t => (
                  <circle key={t.id} cx={t.lng} cy={-t.lat} r={(3.5 + 10 * Math.sqrt(t.siswa / maks)) * u} fill={warna(t)} fillOpacity={0.8} stroke={pilih?.id === t.id ? "#E8A020" : "#ffffff"} strokeWidth={(pilih?.id === t.id ? 2.5 : 1) * u} className="cursor-pointer" onClick={() => setPilih(t)}>
                    <title>{t.nama} — {t.siswa} siswa</title>
                  </circle>
                ))}
              </svg>
            )}
            <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#E8A020]" /> sekolah</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#1B2B6B]" /> ada siswa PKL</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#d97706]" /> kuota penuh</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#94a3b8]" /> belum ada siswa</span>
              <span>Besar lingkaran mengikuti jumlah siswa.</span>
            </p>
          </div>
          <div className="min-w-0 space-y-6 xl:col-span-4">
            <div className="panel p-5">
              {pilih ? (
                <>
                  <p className="panel-judul">{pilih.nama}</p>
                  <dl className="mt-2 space-y-1 text-sm text-gray-600">
                    <div>{[pilih.kecamatan, pilih.kabupaten].filter(Boolean).join(", ") || "Wilayah belum diisi"}{pilih.bidang ? ` · ${pilih.bidang}` : ""}</div>
                    <div><span className="angka font-semibold text-primary-900">{pilih.siswa}</span> siswa sedang PKL{pilih.kuota != null ? ` dari kuota ${pilih.kuota}` : ""}</div>
                    <div><span className="angka">{jarak(pilih)}</span> km garis lurus dari sekolah</div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link href={`/pusat-pkl/dudi/${pilih.id}`} className="btn-modal-cancel px-3 text-xs">Riwayat DUDI</Link>
                    <a href={`https://www.google.com/maps/dir/?api=1&origin=${KITA.lat},${KITA.lng}&destination=${pilih.lat},${pilih.lng}`} target="_blank" rel="noreferrer" className="btn-modal-cancel px-3 text-xs">Rute di Google Maps</a>
                  </div>
                </>
              ) : <p className="text-sm text-gray-400">Ketuk lingkaran di peta untuk melihat DUDI-nya.</p>}
            </div>
            {luar.length > 0 && (
              <div className="panel overflow-hidden">
                <div className="panel-kepala"><p className="panel-judul">Di luar peta kabupaten</p></div>
                <ul className="divide-y divide-gray-100">{luar.map(t => <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"><button type="button" className="min-w-0 truncate text-left text-primary-900 hover:underline" onClick={() => setPilih(t)}>{t.nama}<span className="block text-xs text-gray-400">{t.kabupaten ?? "—"}</span></button><span className="angka shrink-0 text-gray-600">{t.siswa} siswa</span></li>)}</ul>
              </div>
            )}
            {d.tanpaTitik.length > 0 && (
              <div className="panel overflow-hidden">
                <div className="panel-kepala"><p className="panel-judul">Titik lokasi belum diisi</p><Link href="/pusat-pkl/dudi" className="panel-tautan">Data DUDI</Link></div>
                <ul className="divide-y divide-gray-100">{d.tanpaTitik.slice(0, 30).map(t => <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm"><span className="min-w-0 truncate text-gray-700">{t.nama}</span><span className="angka shrink-0 text-gray-400">{t.siswa} siswa</span></li>)}</ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
