"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Loader2, MapPin, Users, GraduationCap, BadgeCheck, ArrowLeft, Maximize2, Minimize2 } from "lucide-react";
import type { WilayahPeta } from "@/lib/peta-batas";
import Select from "@/components/admin/Select";

/** PETA SEBARAN BERJENJANG (7 Oktober 2026): Indonesia (provinsi) → kabupaten/kota → kecamatan → desa.
 *  Batas provinsi/kabupaten/kecamatan dari public/data/peta (dibangun scripts/bangun-peta.ts), batas desa dari
 *  /api/peta/desa/<kab> (diambil server saat pertama dibuka). Warna = jumlah di wilayah itu.
 *  Data: pendaftar SPMB, siswa aktif, atau ALUMNI (siswa LULUS, bisa per angkatan lulus — 8 Okt 2026), dua terakhir dari
 *  alamat Buku Induk. Lapis penduduk sempat ada lalu DIHAPUS (keputusan user
 *  7 Okt 2026: peta untuk melihat asal pendaftar/siswa, bukan data kependudukan) — jangan dihidupkan lagi. */

type Sebaran = { jumlah: Record<string, number>; total: number; tanpaWilayah: number };
type Wilayah = WilayahPeta;
type Lapis = "pendaftar" | "siswa" | "alumni";
type RingkasTracer = { alumni: number; mengisi: number; BEKERJA: number; KULIAH: number; WIRAUSAHA: number; BELUM_BEKERJA: number; LAINNYA: number };
type SebaranAlumni = { semua: Sebaran; perTahun: Record<string, Sebaran>; baris?: [string, string, string][]; tracer?: RingkasTracer };
const STATUS_TRACER: [string, string][] = [["BEKERJA", "Bekerja"], ["KULIAH", "Kuliah"], ["WIRAUSAHA", "Wirausaha"], ["BELUM_BEKERJA", "Belum bekerja/kuliah"], ["LAINNYA", "Lainnya"], ["BELUM", "Belum mengisi tracer"]];
type Jejak = { k: string; n: string }[];

// Lokasi sekolah [bujur, −lintang] — sama dengan peta di halaman Kontak (src/app/contact/page.tsx).
const SEKOLAH: [number, number] = [114.2072342, 8.2907167];

// Skala BERGANTI RONA, bukan satu warna dipekatkan (temuan user 7 Okt 2026: gradasi satu warna sulit dibedakan,
// apalagi di proyektor). Tiap tingkat warnanya berbeda tetapi tetap berurutan terang → gelap.
const SKALA: Record<Lapis, string[]> = {
  pendaftar: ["#fde68a", "#fbbf24", "#f97316", "#dc2626", "#7f1d1d"],
  siswa: ["#c7e9b4", "#7fcdbb", "#41b6c4", "#225ea8", "#081d58"],
  alumni: ["#f3d5ee", "#d8a4d3", "#b46fb6", "#7e3a92", "#3f0d55"],
};
const KOSONG = "#eef0f4";
const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

// Disinggahkan per alamat: pilihan saringan & peta memakai berkas yang sama, jadi tidak diunduh dua kali.
const singgah = new Map<string, Promise<Wilayah[]>>();
function ambil(url: string): Promise<Wilayah[]> {
  let p = singgah.get(url);
  if (!p) {
    p = fetch(url).then(async r => {
      const x = await r.json().catch(() => null);
      if (!r.ok) throw new Error(x?.error ?? "Peta gagal dimuat.");
      return x as Wilayah[];
    });
    p.catch(() => singgah.delete(url));
    singgah.set(url, p);
  }
  return p;
}

const SEBARAN_KOSONG: Sebaran = { jumlah: {}, total: 0, tanpaWilayah: 0 };
const ALUMNI_KOSONG: SebaranAlumni = { semua: SEBARAN_KOSONG, perTahun: {} };
const SEMUA_LAPIS: Lapis[] = ["pendaftar", "siswa", "alumni"];

/** `lapis` = lapis yang tampil di pintu ini (8 Okt 2026, user: "di SPMB fokus SPMB, tracer fokus tracer, siswa fokus siswa"):
 *  Pusat SPMB = pendaftar + siswa (pembanding), Tracer Study = alumni, Data Siswa = siswa. Data lapis lain tidak perlu dikirim. */
export default function PetaSebaran({ pendaftar = SEBARAN_KOSONG, siswa = SEBARAN_KOSONG, alumni = ALUMNI_KOSONG, lapis: lapisTampil = SEMUA_LAPIS }: {
  pendaftar?: Sebaran; siswa?: Sebaran; alumni?: SebaranAlumni; lapis?: Lapis[];
}) {
  const [jejak, setJejak] = useState<Jejak>([]);
  const [wilayah, setWilayah] = useState<Wilayah[] | null>(null);
  const [galat, setGalat] = useState("");
  const [lapis, setLapis] = useState<Lapis>(lapisTampil.includes("pendaftar") && pendaftar.total ? "pendaftar" : lapisTampil.find(l => l !== "pendaftar") ?? lapisTampil[0]);
  const [angkatan, setAngkatan] = useState(""); // "" = semua angkatan lulus
  const [statusTracer, setStatusTracer] = useState(""); // "" = semua; "BELUM" = belum mengisi tracer
  const [pilih, setPilih] = useState<string | null>(null);
  const [sorot, setSorot] = useState<string | null>(null);
  // LAYAR PENUH untuk presentasi ke panitia (permintaan user 7 Okt 2026). Yang dibuat layar penuh SELURUH halaman,
  // lalu panel ini dibentangkan menutupinya (fixed, z-[55]) — bukan elemen panel saja: popup Select dirender di
  // document.body, dan di mode layar penuh elemen hanya anak-anaknya yang tampil, sehingga dropdown saringan hilang.
  // Peramban tanpa Fullscreen API (iPhone) tetap mendapat bentangan menutupi layar.
  const [penuh, setPenuh] = useState(false);
  useEffect(() => {
    // Esc di layar penuh asli ditangani peramban (→ fullscreenchange). Sengaja TANPA pendengar Esc sendiri:
    // Esc juga dipakai menutup dropdown saringan, dan tidak boleh ikut mengakhiri presentasi.
    const keluar = () => { if (!document.fullscreenElement) setPenuh(false); };
    document.addEventListener("fullscreenchange", keluar);
    return () => document.removeEventListener("fullscreenchange", keluar);
  }, []);
  async function aturPenuh(nyala: boolean) {
    setPenuh(nyala);
    try {
      if (nyala && !document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      if (!nyala && document.fullscreenElement) await document.exitFullscreen();
    } catch { /* tetap memakai bentangan CSS */ }
  }
  const tingkat = jejak.length; // 0 prov · 1 kab · 2 kec · 3 desa
  // Lebar peta yang BENAR-BENAR tampil — ukuran angka & penanda dihitung darinya supaya tetap terbaca di HP.
  const wadah = useRef<HTMLDivElement>(null);
  const [ukuranTampil, setUkuranTampil] = useState({ w: 760, h: 0 });
  useEffect(() => {
    const el = wadah.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width) setUkuranTampil({ w: e.contentRect.width, h: e.contentRect.height }); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    setWilayah(null); setGalat(""); setPilih(null);
    const t = jejak[jejak.length - 1]?.k;
    const url = tingkat === 0 ? "/data/peta/prov.json" : tingkat === 1 ? `/data/peta/kab/${t}.json`
      : tingkat === 2 ? `/data/peta/kec/${t}.json` : `/api/peta/desa/${t.slice(0, 5)}`;
    let batal = false;
    ambil(url)
      .then(w => { if (!batal) setWilayah(tingkat === 3 ? w.filter(x => x.k.startsWith(t + ".")) : w); })
      .catch(e => { if (!batal) setGalat(e instanceof Error ? e.message : "Peta gagal dimuat."); });
    return () => { batal = true; };
  }, [jejak, tingkat]);

  // SARINGAN BERJENJANG (permintaan user 7 Okt 2026: "filter kecamatan / desa") — Provinsi → Kabupaten → Kecamatan
  // → Desa. Satu sumber dengan ketukan peta: memilih = mengubah `jejak`, mengetuk peta = mengubah pilihan.
  const [daftarProv, setDaftarProv] = useState<Wilayah[]>([]);
  const [daftarKab, setDaftarKab] = useState<Wilayah[]>([]);
  const [daftarKec, setDaftarKec] = useState<Wilayah[]>([]);
  useEffect(() => { ambil("/data/peta/prov.json").then(setDaftarProv).catch(() => {}); }, []);
  const kodeProv = jejak[0]?.k, kodeKab = jejak[1]?.k;
  useEffect(() => {
    if (!kodeProv) { setDaftarKab([]); return; }
    ambil(`/data/peta/kab/${kodeProv}.json`).then(setDaftarKab).catch(() => setDaftarKab([]));
  }, [kodeProv]);
  useEffect(() => {
    if (!kodeKab) { setDaftarKec([]); return; }
    ambil(`/data/peta/kec/${kodeKab}.json`).then(setDaftarKec).catch(() => setDaftarKec([]));
  }, [kodeKab]);

  const lapisAktif = lapis;
  // Saringan status tracer dihitung di sini dari baris tanpa identitas [kode, tahun lulus, status] — supaya bisa
  // digabung dengan saringan angkatan. Tanpa saringan status, hitungan server dipakai apa adanya.
  const dataAlumni = useMemo<Sebaran>(() => {
    if (!statusTracer || !alumni.baris) return (angkatan && alumni.perTahun[angkatan]) || alumni.semua;
    const jumlah: Record<string, number> = {};
    let total = 0, tanpa = 0;
    for (const [kode, th, st] of alumni.baris) {
      if (angkatan && th !== angkatan) continue;
      if (statusTracer === "BELUM" ? st !== "" : st !== statusTracer) continue;
      total++;
      if (!kode) { tanpa++; continue; }
      const b = kode.split(".");
      for (let i = 1; i <= b.length; i++) { const k = b.slice(0, i).join("."); jumlah[k] = (jumlah[k] ?? 0) + 1; }
    }
    return { jumlah, total, tanpaWilayah: tanpa };
  }, [alumni, angkatan, statusTracer]);
  const dataLapis = lapisAktif === "siswa" ? siswa : lapisAktif === "alumni" ? dataAlumni : pendaftar;

  const opsi = (daftar: Wilayah[], semua: string) => [
    { value: "", label: semua },
    ...[...daftar].sort((a, b) => (dataLapis.jumlah[b.k] ?? 0) - (dataLapis.jumlah[a.k] ?? 0) || a.n.localeCompare(b.n, "id"))
      .map(w => ({ value: w.k, label: dataLapis.jumlah[w.k] ? `${w.n} (${dataLapis.jumlah[w.k]})` : w.n })),
  ];
  const pilihTingkat = (i: number, daftar: Wilayah[]) => (v: string) => {
    const w = daftar.find(x => x.k === v);
    setJejak(j => (w ? [...j.slice(0, i), { k: w.k, n: w.n }] : j.slice(0, i)));
    setSorot(null);
  };

  const nilai = useMemo(() => {
    const m = new Map<string, number>();
    for (const w of wilayah ?? []) m.set(w.k, dataLapis.jumlah[w.k] ?? 0);
    return m;
  }, [wilayah, dataLapis]);
  const maks = Math.max(0, ...nilai.values());
  // Batas kelas mengikuti SEBARAN data di tingkat yang sedang dibuka (kuantil), supaya daerah terbagi rata ke
  // beberapa warna — bukan semuanya jatuh di satu kelas. Ragam angka ≤5 → tiap angka warnanya sendiri.
  const kelasPeta = useMemo(() => {
    const isi = [...nilai.values()].filter(v => v > 0).sort((a, b) => a - b);
    const unik = [...new Set(isi)];
    const batas = unik.length <= 5 ? unik
      : [...new Set([1, 2, 3, 4, 5].map(q => isi[Math.max(0, Math.ceil((q / 5) * isi.length) - 1)]))];
    const k = batas.length;
    const palet = SKALA[lapisAktif];
    const warnaKe = Array.from({ length: k }, (_, i) => (k === 1 ? 3 : Math.round((i * 4) / (k - 1))));
    const rentang = batas.map((hi, i) => {
      const lo = i === 0 ? (isi[0] ?? hi) : Math.floor(batas[i - 1]) + 1;
      return lo >= hi ? fmt(hi) : `${fmt(lo)}–${fmt(hi)}`;
    });
    return { batas, warna: warnaKe.map(i => palet[i]), gelap: warnaKe.map(i => i >= 3), rentang };
  }, [nilai, lapisAktif]);
  const kelas = (v: number) => (v <= 0 ? -1 : Math.max(0, kelasPeta.batas.findIndex(b => v <= b)));
  const warna = (v: number) => (kelas(v) < 0 ? KOSONG : kelasPeta.warna[kelas(v)]);

  const kotak = useMemo(() => {
    if (!wilayah?.length) return null;
    let [a, b, c, d] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const w of wilayah) { a = Math.min(a, w.b[0]); b = Math.min(b, w.b[1]); c = Math.max(c, w.b[2]); d = Math.max(d, w.b[3]); }
    const pad = Math.max(c - a, d - b) * 0.03;
    return { x: a - pad, y: b - pad, w: c - a + 2 * pad, h: d - b + 2 * pad };
  }, [wilayah]);
  // Satuan "1 piksel layar" dalam koordinat peta (SVG "meet": skala = sisi yang paling membatasi).
  const u = kotak ? Math.max(kotak.w / ukuranTampil.w, ukuranTampil.h ? kotak.h / ukuranTampil.h : 0) : 1;

  const urut = useMemo(() => (wilayah ?? []).map(w => ({ w, v: nilai.get(w.k) ?? 0 })).filter(x => x.v > 0).sort((a, b) => b.v - a.v), [wilayah, nilai]);
  const terpilih = wilayah?.find(w => w.k === pilih) ?? null;
  const bisaTurun = tingkat < 3;
  const turun = (w: Wilayah) => { if (bisaTurun) { setJejak(j => [...j, { k: w.k, n: w.n }]); setSorot(null); } };
  const label = ["provinsi", "kabupaten/kota", "kecamatan", "desa/kelurahan"][tingkat];
  const satuan = lapisAktif === "siswa" ? "siswa" : lapisAktif === "alumni" ? (angkatan ? `alumni ${angkatan}` : "alumni") + (statusTracer ? ` (${STATUS_TRACER.find(x => x[0] === statusTracer)?.[1].toLowerCase()})` : "") : "pendaftar";
  const sekolahTampak = kotak && SEKOLAH[0] >= kotak.x && SEKOLAH[0] <= kotak.x + kotak.w && SEKOLAH[1] >= kotak.y && SEKOLAH[1] <= kotak.y + kotak.h;

  return (
    <div className={penuh ? "fixed inset-0 z-[55] space-y-4 overflow-y-auto bg-white p-4 sm:p-6" : "space-y-4"}>
      <div className="baris-alat">
        <div className={`alat-tab w-fit max-w-full gap-1 overflow-x-auto rounded-xl border border-gray-100 bg-white p-1 scrollbar-hide ${lapisTampil.length > 1 ? "flex" : "hidden"}`}>
          {([["pendaftar", "Pendaftar SPMB", Users], ["siswa", "Siswa Aktif", GraduationCap], ["alumni", "Alumni", BadgeCheck]] as const).filter(x => lapisTampil.includes(x[0])).map(([k, l, Ik]) => (
            <button key={k} type="button" onClick={() => setLapis(k)}
              className={`sentuh inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${lapisAktif === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              <Ik size={15} /> {l}
            </button>
          ))}
        </div>
        {lapisAktif === "alumni" && (
          <div className="alat-saring w-full sm:w-56">
            <Select value={angkatan} onChange={setAngkatan} placeholder="Semua angkatan lulus" options={[
              { value: "", label: `Semua angkatan lulus (${alumni.semua.total})` },
              // Kunci objek berupa angka ("2025") selalu diurutkan JavaScript dari kecil, jadi diurutkan ulang: terbaru di atas.
              ...Object.entries(alumni.perTahun).sort((a, b) => b[0].localeCompare(a[0])).map(([th, x]) => ({ value: th, label: `Lulusan ${th} (${x.total})` })),
            ]} />
          </div>
        )}
        {lapisAktif === "alumni" && alumni.baris && (
          <div className="alat-saring w-full sm:w-56">
            <Select value={statusTracer} onChange={setStatusTracer} placeholder="Semua status" options={[
              { value: "", label: "Semua status tracer" },
              ...STATUS_TRACER.map(([v, l]) => ({ value: v, label: l })),
            ]} />
          </div>
        )}
        <div className="alat-aksi">
          <button type="button" onClick={() => aturPenuh(!penuh)} className="btn-modal-cancel btn-teks">
            {penuh ? <><Minimize2 size={16} /> Keluar Layar Penuh</> : <><Maximize2 size={16} /> Layar Penuh</>}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <label className="label-field">Provinsi</label>
          <Select value={kodeProv ?? ""} onChange={pilihTingkat(0, daftarProv)} options={opsi(daftarProv, "Semua provinsi")} placeholder="Semua provinsi" />
        </div>
        <div className="min-w-0">
          <label className="label-field">Kabupaten/Kota</label>
          <Select value={kodeKab ?? ""} onChange={pilihTingkat(1, daftarKab)} options={opsi(daftarKab, "Semua kabupaten/kota")}
            disabled={!kodeProv} placeholder={kodeProv ? "Semua kabupaten/kota" : "Pilih provinsi dulu"} />
        </div>
        <div className="min-w-0">
          <label className="label-field">Kecamatan</label>
          <Select value={jejak[2]?.k ?? ""} onChange={pilihTingkat(2, daftarKec)} options={opsi(daftarKec, "Semua kecamatan")}
            disabled={!kodeKab} placeholder={kodeKab ? "Semua kecamatan" : "Pilih kabupaten dulu"} />
        </div>
        <div className="min-w-0">
          <label className="label-field">Desa/Kelurahan</label>
          <Select value={tingkat === 3 && pilih ? pilih : ""} onChange={v => setPilih(v || null)}
            options={tingkat === 3 && wilayah ? opsi(wilayah, "Semua desa/kelurahan") : [{ value: "", label: "Semua desa/kelurahan" }]}
            disabled={tingkat < 3 || !wilayah} placeholder={tingkat < 3 ? "Pilih kecamatan dulu" : "Semua desa/kelurahan"} />
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-1 text-sm" aria-label="Tingkat wilayah">
        {tingkat > 0 && (
          <button type="button" onClick={() => setJejak(j => j.slice(0, -1))} className="btn-modal-cancel mr-1 px-3 py-1.5 text-xs"><ArrowLeft size={14} /> Naik</button>
        )}
        {[{ k: "", n: "Indonesia" }, ...jejak].map((j, i, a) => (
          <span key={j.k || "id"} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} className="text-gray-300" />}
            {i < a.length - 1
              ? <button type="button" onClick={() => setJejak(jj => jj.slice(0, i))} className="font-medium text-primary-700 hover:underline">{j.n}</button>
              : <span className="font-semibold text-navy">{j.n}</span>}
          </span>
        ))}
      </nav>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12 items-start">
        <div className={`min-w-0 ${penuh ? "xl:col-span-9" : "xl:col-span-8"}`}>
          <div ref={wadah} className="relative overflow-hidden rounded-xl border border-gray-100 bg-[#f7f9fc]">
            {galat ? <p className="py-10 text-center text-sm text-gray-400">{galat}</p> : !wilayah || !kotak ? (
              <div className="flex h-72 items-center justify-center text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
            ) : (
              <svg viewBox={`${kotak.x} ${kotak.y} ${kotak.w} ${kotak.h}`} className={`block w-full touch-manipulation ${penuh ? "max-h-[78dvh]" : "max-h-[70dvh]"}`} role="img"
                aria-label={`Peta sebaran ${satuan} per ${label}`} onMouseLeave={() => setSorot(null)}>
                {wilayah.map(w => {
                  const v = nilai.get(w.k) ?? 0;
                  const aktif = w.k === pilih || w.k === sorot;
                  return (
                    <path key={w.k} d={w.d} fill={warna(v)} stroke={aktif ? "#E8A020" : "#ffffff"} strokeWidth={aktif ? 2 : 0.7}
                      vectorEffect="non-scaling-stroke" className="cursor-pointer transition-[fill] duration-200"
                      onMouseEnter={() => setSorot(w.k)} onClick={() => (pilih === w.k ? turun(w) : setPilih(w.k))} onDoubleClick={() => turun(w)}>
                      <title>{`${w.n}: ${fmt(v)} ${satuan}`}</title>
                    </path>
                  );
                })}
                {/* Garis tepi wilayah terpilih digambar ulang di atas supaya tidak tertutup tetangganya. */}
                {[pilih, sorot].filter((k, i, a) => k && a.indexOf(k) === i).map(k => {
                  const w = wilayah.find(x => x.k === k);
                  return w ? <path key={`s-${k}`} d={w.d} fill="none" stroke="#E8A020" strokeWidth={2} vectorEffect="non-scaling-stroke" pointerEvents="none" /> : null;
                })}
                {/* Penanda sekolah digambar SEBELUM angka supaya angka wilayah tidak tertutup. */}
                {sekolahTampak && (
                  <g pointerEvents="none">
                    <circle cx={SEKOLAH[0]} cy={SEKOLAH[1]} r={7 * u} fill="#E8A020" stroke="#ffffff" strokeWidth={2 * u} />
                    <circle cx={SEKOLAH[0]} cy={SEKOLAH[1]} r={2.5 * u} fill="#0F1A45" />
                  </g>
                )}
                {tingkat >= 1 && urut.slice(0, 40).map(({ w, v }) => (
                  <g key={`l-${w.k}`} pointerEvents="none">
                    <text x={w.c[0]} y={w.c[1]} textAnchor="middle" dominantBaseline="central" fontSize={11 * u} fontWeight={700}
                      fill={kelasPeta.gelap[kelas(v)] ? "#ffffff" : "#0F1A45"} stroke={kelasPeta.gelap[kelas(v)] ? "#0F1A45" : "#ffffff"} strokeWidth={2.5 * u} paintOrder="stroke">
                      {v}
                    </text>
                  </g>
                ))}
              </svg>
            )}
            {wilayah && maks > 0 && (
              <div className="pointer-events-none m-2 w-fit rounded-lg border border-gray-100 bg-white/90 px-2.5 py-2 text-xs text-gray-600 shadow-sm sm:absolute sm:bottom-2 sm:left-2 sm:m-0">
                <p className="mb-1 font-semibold text-navy">{satuan}</p>
                <ul className="flex flex-wrap gap-x-3 gap-y-1 sm:block sm:space-y-0.5">
                  {kelasPeta.warna.map((c, i) => (
                    <li key={c} className="flex items-center gap-1.5"><span className="h-3 w-4 shrink-0 rounded-sm" style={{ background: c }} /><span className="angka">{kelasPeta.rentang[i]}</span></li>
                  )).reverse()}
                  <li className="flex items-center gap-1.5"><span className="h-3 w-4 shrink-0 rounded-sm border border-gray-200" style={{ background: KOSONG }} /><span>0</span></li>
                </ul>
              </div>
            )}
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
            <span>Ketuk wilayah untuk melihat angkanya, ketuk lagi untuk membuka {["kabupaten/kota", "kecamatan", "desa"][tingkat] ?? "rinciannya"}.</span>
            {sekolahTampak && <span className="inline-flex items-center gap-1"><MapPin size={12} className="text-gold" /> lokasi sekolah</span>}
          </p>
        </div>

        <div className={`min-w-0 space-y-4 ${penuh ? "xl:col-span-3" : "xl:col-span-4"}`}>
          {terpilih && (
            <div className="rounded-xl border border-gold/40 bg-amber-50/50 p-4">
              <p className="font-heading text-sm font-semibold text-navy">{terpilih.n}</p>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                {lapisTampil.includes("pendaftar") && <div><dt className="text-xs text-gray-500">Pendaftar</dt><dd className="angka font-semibold text-navy">{fmt(pendaftar.jumlah[terpilih.k] ?? 0)}</dd></div>}
                {lapisTampil.includes("siswa") && <div><dt className="text-xs text-gray-500">Siswa aktif</dt><dd className="angka font-semibold text-navy">{fmt(siswa.jumlah[terpilih.k] ?? 0)}</dd></div>}
                {lapisTampil.includes("alumni") && <div><dt className="text-xs text-gray-500">{angkatan ? `Alumni ${angkatan}` : "Alumni"}</dt><dd className="angka font-semibold text-navy">{fmt(dataAlumni.jumlah[terpilih.k] ?? 0)}</dd></div>}
              </dl>
              {bisaTurun && <button type="button" onClick={() => turun(terpilih)} className="btn-modal-save mt-3 w-full">Buka {["kabupaten/kota", "kecamatan", "desa"][tingkat]} <ChevronRight size={16} /></button>}
            </div>
          )}
          <div>
            <p className="label-kecil mb-2">Peringkat {label}</p>
            {!wilayah ? null : urut.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada {satuan} dari {label} di wilayah ini.</p>
            ) : (
              <ol className="space-y-1.5">
                {urut.slice(0, 12).map(({ w, v }, i) => (
                  <li key={w.k}>
                    <button type="button" onClick={() => setPilih(w.k)} onMouseEnter={() => setSorot(w.k)} onMouseLeave={() => setSorot(null)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-gray-50 ${pilih === w.k ? "bg-amber-50" : ""}`}>
                      <span className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="min-w-0 truncate text-gray-700"><span className="angka mr-1.5 text-xs text-gray-400">{i + 1}</span>{w.n}</span>
                        <span className="angka shrink-0 font-semibold text-navy">{fmt(v)}</span>
                      </span>
                      <span className="mt-1 block h-1.5 rounded-full bg-gray-100">
                        <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(4, (v / urut[0].v) * 100)}%`, background: warna(v) }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
          {lapisAktif === "alumni" && alumni.tracer && (
            <div className="rounded-xl border border-gray-100 bg-[#f5f6fa] p-3 text-xs text-gray-600">
              <p className="font-semibold text-navy">Keterserapan lulusan</p>
              {alumni.tracer.mengisi < 20 ? (
                // Persen baru ditulis bila pengisinya cukup — "100%" dari satu orang bukan angka keterserapan.
                <p className="mt-1 text-sm text-gray-400">
                  Baru {fmt(alumni.tracer.mengisi)} dari {fmt(alumni.tracer.alumni)} alumni yang mengisi tracer study — belum cukup untuk dihitung (minimal 20).
                </p>
              ) : (
                <>
                  <p className="mt-1">
                    <span className="angka font-semibold text-navy">{Math.round(((alumni.tracer.BEKERJA + alumni.tracer.KULIAH + alumni.tracer.WIRAUSAHA) / alumni.tracer.mengisi) * 100)}%</span>{" "}
                    dari {fmt(alumni.tracer.mengisi)} alumni yang mengisi sudah bekerja, kuliah, atau berwirausaha
                    ({fmt(alumni.tracer.BEKERJA)} bekerja · {fmt(alumni.tracer.KULIAH)} kuliah · {fmt(alumni.tracer.WIRAUSAHA)} wirausaha).
                  </p>
                  <p className="mt-1 text-gray-500">Baru {fmt(alumni.tracer.mengisi)} dari {fmt(alumni.tracer.alumni)} alumni yang mengisi — angka ini belum mewakili seluruh lulusan.</p>
                </>
              )}
            </div>
          )}
          {dataLapis.tanpaWilayah > 0 && (
            <p className="text-xs text-gray-500">
              {dataLapis.tanpaWilayah} dari {dataLapis.total} {lapisAktif === "pendaftar" ? "pendaftar tidak mengisi wilayah" : `${lapisAktif === "alumni" ? satuan : "siswa aktif"} belum terpetakan (alamat Buku Induk kosong atau nama wilayahnya tidak dikenali)`}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
