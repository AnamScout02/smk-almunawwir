"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, LayoutGrid, Loader2, Save, Search, SlidersHorizontal, X } from "lucide-react";
import Modal from "@/components/admin/Modal";
import type { LucideIcon } from "lucide-react";
import { GambarIlustrasi, ilustrasiUntuk, warnaMenu } from "@/components/shared/IlustrasiMenu";

export interface ItemMenuKisi { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number }
export interface GrupMenuKisi { label: string | null; items: ItemMenuKisi[] }

/** Delapan gradasi ikon yang bergilir menurut urutan menu — meniru pewarnaan aplikasi bank
 * (BRImo/Livin): tiap fitur punya warna sendiri supaya cepat dikenali mata, sementara warna DASAR
 * aplikasi tetap navy sekolah (permintaan user 18 September 2026). Warna ditentukan urutan, jadi
 * satu menu selalu mendapat warna yang sama setiap halaman dibuka. */
const PER_GRUP = 8; // 2 baris × 4 ikon

const GRADASI = [
  "linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)", // biru
  "linear-gradient(135deg, #10B981 0%, #047857 100%)", // hijau
  "linear-gradient(135deg, #F59E0B 0%, #B45309 100%)", // kuning
  "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)", // ungu
  "linear-gradient(135deg, #F43F5E 0%, #BE123C 100%)", // merah muda
  "linear-gradient(135deg, #14B8A6 0%, #0F766E 100%)", // toska
  "linear-gradient(135deg, #6366F1 0%, #4338CA 100%)", // nila
  "linear-gradient(135deg, #1B2B6B 0%, #0F1A45 100%)", // navy sekolah
];

/** Label kartu dipendekkan: keterangan dalam kurung dibuang ("Ujian Online (CBT)" → "Ujian Online")
 * supaya tidak terpotong "…" di kisi 4 kolom. Nama asli tetap dipakai di sidebar & judul halaman. */
const labelKisi = (teks: string) => teks.replace(/\s*\([^)]*\)\s*$/, "").trim();

function Kartu({ item }: { item: ItemMenuKisi }) {
  // Gambar mengikuti FITURNYA (pemetaan alamat → kata kunci nama menu); warna ubin tetap per menu
  // sehingga sama di dashboard maupun halaman Semua Menu.
  const gambar = ilustrasiUntuk(item.href, item.label);
  const warna = warnaMenu(item.href, GRADASI.length);
  return (
    <Link href={item.href} className="kartu-menu">
      {/* SATU gaya: chip gradasi + gambar putih. Menu inti memakai ilustrasi berlapis, sisanya ikon
          garis — keduanya putih di atas chip yang sama sehingga tampak satu keluarga. */}
      <span className="ikon-menu" style={{ background: GRADASI[warna] }}>
        <GambarIlustrasi nama={gambar} className="h-[86%] w-[86%]" />
        {(item.badge ?? 0) > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white ring-2 ring-white">
            {item.badge! > 99 ? "99+" : item.badge}
          </span>
        )}
      </span>
      <span className="line-clamp-2 w-full text-xs font-medium leading-tight text-gray-700">{labelKisi(item.label)}</span>
    </Link>
  );
}

/** KISI MENU ALA APLIKASI BANK (18 September 2026 — contoh yang dikirim user: Livin' & BRImo).
 *
 * Menggantikan bottom sheet berisi daftar menu: SELURUH fitur portal dikumpulkan di dashboard
 * sebagai kisi ikon berwarna. Dua mode:
 *   - `ringkas={n}`: n−1 menu yang paling sering dipakai + kartu "Lihat Semua" (dipasang di dashboard),
 *   - tanpa `ringkas`: halaman menu lengkap — kotak "Cari menu" + semua grup berjudul.
 * `pintasan` menampilkan pita navy berisi maksimal 4 aksi utama di atas kisi (padanan baris
 * Transfer/BRIVA/E-Wallet/Pulsa di BRImo).
 * Sumber menunya SATU dengan sidebar desktop (pembangun grup diekspor dari tiap Sidebar), jadi menu
 * baru otomatis muncul di sidebar, bottom nav, dan kisi ini tanpa didaftar ulang. */
export default function MenuLengkap({ grup, judul = "Semua Menu", ringkas, hrefSemua, pintasan = [], cari = true, favoritAwal }: {
  grup: GrupMenuKisi[];
  judul?: string;
  ringkas?: number;
  hrefSemua?: string;
  pintasan?: ItemMenuKisi[];
  cari?: boolean;
  /** Menu Cepat pilihan akun yang SUDAH dibaca di server (lihat `menuFavoritAkun`). Diberikan =
   *  render pertama langsung benar, tanpa kedipan kisi bawaan. `undefined` = halaman tidak
   *  mengirimnya → jatuh ke pengambilan dari klien seperti dulu. */
  favoritAwal?: string[] | null;
}) {
  const [kata, setKata] = useState("");
  const [terbuka, setTerbuka] = useState<Set<string>>(new Set());
  // Menu Cepat pilihan pengguna (null = belum pernah diatur → pakai urutan bawaan portal).
  const [favorit, setFavorit] = useState<string[] | null>(favoritAwal ?? null);
  const [aturBuka, setAturBuka] = useState(false);
  const [pilihan, setPilihan] = useState<string[]>([]);
  const [simpanSibuk, setSimpanSibuk] = useState(false);
  const [seret, setSeret] = useState<number | null>(null);

  /** Tukar dua posisi (tombol panah untuk layar sentuh). */
  const tukar = (a: number, b: number) => setPilihan(p => {
    if (b < 0 || b >= p.length) return p;
    const baru = [...p];
    [baru[a], baru[b]] = [baru[b], baru[a]];
    return baru;
  });
  /** Jatuhkan ikon yang sedang diseret ke posisi tujuan (tarik-lepas di layar lebar). */
  const pindah = (tujuan: number) => setPilihan(p => {
    if (seret === null || seret === tujuan) return p;
    const baru = [...p];
    const [diambil] = baru.splice(seret, 1);
    baru.splice(tujuan, 0, diambil);
    return baru;
  });
  const semuaItem = useMemo(() => grup.flatMap(g => g.items), [grup]);

  useEffect(() => {
    // Sudah dikirim server → tidak perlu diambil ulang (ini yang dulu menyebabkan kedipan).
    if (!ringkas || favoritAwal !== undefined) return;
    fetch("/api/menu-favorit", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.hrefs)) setFavorit(d.hrefs); })
      .catch(() => {});
  }, [ringkas, favoritAwal]);

  async function simpanFavorit() {
    setSimpanSibuk(true);
    const r = await fetch("/api/menu-favorit", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hrefs: pilihan }),
    }).catch(() => null);
    setSimpanSibuk(false);
    if (r?.ok) { setFavorit(pilihan); setAturBuka(false); }
  }

  const PitaPintasan = pintasan.length > 0 ? (
    <div className="pita-pintasan mb-4 grid grid-cols-4 gap-1 p-2">
      {pintasan.slice(0, 4).map(i => {
        const gambarPintasan = ilustrasiUntuk(i.href, i.label);
        return (
          <Link key={i.href} href={i.href} className="pintasan-item">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/15">
              <GambarIlustrasi nama={gambarPintasan} className="h-full w-full p-1" />
              {(i.badge ?? 0) > 0 && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-primary-900" />}
            </span>
            <span className="line-clamp-2 w-full text-center text-[0.72rem] font-semibold leading-tight text-white/90">{labelKisi(i.label)}</span>
          </Link>
        );
      })}
    </div>
  ) : null;

  if (ringkas) {
    const maks = Math.max(0, ringkas - 1);
    // Bila pengguna sudah mengatur sendiri, urutannya ikut pilihannya; bila belum, urutan bawaan.
    const pilihanValid = (favorit ?? []).map(h => semuaItem.find(i => i.href === h)).filter(Boolean) as ItemMenuKisi[];
    const tampil = pilihanValid.length ? pilihanValid.slice(0, maks) : semuaItem.slice(0, maks);
    return (
      <section className="panel p-4 sm:p-5">
        {PitaPintasan}
        {/* Tautan "Lihat semua" hanya SEKALI — sebagai kartu terakhir di kisi (temuan user 18 Sep 2026: dobel). */}
        <div className="mb-1 flex items-center justify-between gap-3">
          <p className="label-kecil">{judul}</p>
          <button type="button" onClick={() => { setPilihan(favorit ?? semuaItem.slice(0, maks).map(i => i.href)); setAturBuka(true); }}
            className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700 hover:underline">
            <SlidersHorizontal size={13} /> Atur
          </button>
        </div>
        <div className="kisi-menu grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-8">
          {tampil.map(i => <Kartu key={i.href} item={i} />)}
          {hrefSemua && (
            <Link href={hrefSemua} className="kartu-menu">
              <span className="ikon-menu" style={{ background: "linear-gradient(135deg, #6B7280 0%, #374151 100%)" }}><LayoutGrid size={21} strokeWidth={1.9} /></span>
              <span className="line-clamp-2 w-full text-xs font-semibold leading-tight text-primary-900">Lihat Semua</span>
            </Link>
          )}
        </div>

        <Modal open={aturBuka} onClose={() => !simpanSibuk && setAturBuka(false)} title="Atur Menu Cepat"
          description={`Ketuk ikon untuk menambah; geser ikon terpilih untuk mengubah urutan (maksimal ${maks})`} size="lg" scrollBody
          footer={<>
            <button type="button" onClick={() => setPilihan([])} className="btn-modal-cancel">Kosongkan</button>
            <button type="button" onClick={simpanFavorit} disabled={simpanSibuk} className="btn-modal-save">
              {simpanSibuk ? <Loader2 className="animate-spin" /> : <Save />} Simpan
            </button>
          </>}>
          <div className="space-y-5">
            <section>
              <p className="label-kecil mb-2">Terpilih ({pilihan.length}/{maks})</p>
              {pilihan.length === 0 ? (
                <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">Belum ada yang dipilih — memakai urutan bawaan portal.</p>
              ) : (
                <ul className="kisi-menu grid grid-cols-4 gap-1 sm:grid-cols-6">
                  {pilihan.map((href, n) => {
                    const item = semuaItem.find(i => i.href === href);
                    if (!item) return null;
                    return (
                      <li key={href} draggable onDragStart={() => setSeret(n)} onDragOver={e => e.preventDefault()}
                        onDrop={() => pindah(n)} onDragEnd={() => setSeret(null)}
                        className={`kartu-menu cursor-grab active:cursor-grabbing ${seret === n ? "opacity-50" : ""}`}>
                        <span className="ikon-menu" style={{ background: GRADASI[warnaMenu(href, GRADASI.length)] }}><GambarIlustrasi nama={ilustrasiUntuk(href, item.label)} className="h-[86%] w-[86%]" /></span>
                        <span className="line-clamp-2 w-full text-xs font-medium leading-tight text-gray-700">{labelKisi(item.label)}</span>
                        <span className="flex items-center gap-1">
                          <button type="button" title="Geser kiri" onClick={() => tukar(n, n - 1)} disabled={n === 0}
                            className="rounded p-0.5 text-gray-400 disabled:opacity-30 hover:text-primary-700"><ChevronLeft size={14} /></button>
                          <button type="button" title="Hapus dari menu cepat" onClick={() => setPilihan(p => p.filter(h => h !== href))}
                            className="rounded p-0.5 text-gray-400 hover:text-red-600"><X size={14} /></button>
                          <button type="button" title="Geser kanan" onClick={() => tukar(n, n + 1)} disabled={n === pilihan.length - 1}
                            className="rounded p-0.5 text-gray-400 disabled:opacity-30 hover:text-primary-700"><ChevronRight size={14} /></button>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {grup.filter(g => g.items.some(i => !pilihan.includes(i.href))).map((g, gi) => (
              <section key={g.label ?? `pilih-${gi}`}>
                {g.label && <p className="label-kecil mb-1">{g.label}</p>}
                <div className="kisi-menu grid grid-cols-4 gap-1 sm:grid-cols-6">
                  {g.items.filter(i => !pilihan.includes(i.href)).map(i => {
                    const penuh = pilihan.length >= maks;
                    return (
                      <button key={i.href} type="button" disabled={penuh}
                        onClick={() => setPilihan(p => [...p, i.href])}
                        className={`kartu-menu ${penuh ? "opacity-40" : ""}`}>
                        <span className="ikon-menu" style={{ background: GRADASI[warnaMenu(i.href, GRADASI.length)] }}><GambarIlustrasi nama={ilustrasiUntuk(i.href, i.label)} className="h-[86%] w-[86%]" /></span>
                        <span className="line-clamp-2 w-full text-xs font-medium leading-tight text-gray-700">{labelKisi(i.label)}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </Modal>
      </section>
    );
  }

  const q = kata.trim().toLowerCase();
  const tersaring = q
    ? [{ label: `Hasil pencarian "${kata.trim()}"`, items: semuaItem.filter(i => i.label.toLowerCase().includes(q)) }]
    : grup.filter(g => g.items.length > 0);

  return (
    <div className="space-y-5">
      {PitaPintasan}
      {cari && (
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={kata} onChange={e => setKata(e.target.value)} placeholder="Cari menu..." className="input-field pl-10" />
        </div>
      )}
      {tersaring.every(g => g.items.length === 0) ? (
        <p className="panel px-5 py-10 text-center text-sm text-gray-400">Tidak ada menu yang cocok.</p>
      ) : (
        tersaring.map((g, gi) => {
          // Tiap grup menampilkan 2 baris × 4 ikon (8 menu); sisanya di balik tombol "Lainnya"
          // yang berubah jadi "Tutup" saat dibuka (permintaan user 18 Sep 2026). Saat mencari,
          // semua hasil ditampilkan apa adanya supaya tidak ada yang tersembunyi.
          const kunci = g.label ?? `grup-${gi}`;
          const semua = !!q || terbuka.has(kunci);
          const tampil = semua ? g.items : g.items.slice(0, PER_GRUP);
          const sisa = g.items.length - tampil.length;
          return (
            <section key={kunci} className="panel p-4 sm:p-5">
              {g.label && <p className="label-kecil mb-1">{g.label}</p>}
              <div className="kisi-menu grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-8">
                {tampil.map(i => <Kartu key={i.href} item={i} />)}
              </div>
              {!q && g.items.length > PER_GRUP && (
                <div className="mt-2 flex justify-center">
                  <button type="button" onClick={() => setTerbuka(t => {
                    const baru = new Set(t);
                    if (baru.has(kunci)) baru.delete(kunci); else baru.add(kunci);
                    return baru;
                  })} className="btn-modal-cancel px-3 text-xs">
                    {semua ? <><ChevronUp /> Tutup</> : <><ChevronDown /> Lainnya ({sisa})</>}
                  </button>
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
