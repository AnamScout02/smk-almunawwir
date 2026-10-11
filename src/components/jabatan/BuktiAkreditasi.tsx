"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, FolderCheck, Loader2, Pencil, Plus, Save, Search, Trash2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Butir { id: string; kode: string; kelompok: string; judul: string; uraian: string; sumber: string[]; tautan: { label: string; url: string }[]; catatan: string }
interface Sumber { kunci: string; label: string; satuan: string; admin: string | null; guru: string | null; jumlah: number | null }
interface Data { semester: string; tahunAjaran: string; butir: Butir[]; bawaan: boolean; katalog: Sumber[]; error?: string }
const KOSONG: Butir = { id: "", kode: "", kelompok: "", judul: "", uraian: "", sumber: [], tautan: [], catatan: "" };

/** BUKTI AKREDITASI (src/lib/bukti-akreditasi.ts) — tiap butir menaut ke data yang sudah ada di situs. Satu komponen dua
 *  portal; di portal guru hanya sumber yang PASTI bisa dibuka pemegang jabatan yang diberi tautan (CLAUDE.md #45). */
export default function BuktiAkreditasi({ portal }: { portal: "admin" | "guru" }) {
  const toast = useToast(), confirm = useConfirm();
  const [d, setD] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [sunting, setSunting] = useState<Butir | null>(null);
  const [simpan, setSimpan] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/mutu/bukti-akreditasi", { cache: "no-store" })
      .then(async r => { const j = await r.json().catch(() => null); if (!r.ok || !j) setGalat(j?.error ?? "Gagal memuat data."); else setD(j); })
      .catch(() => setGalat("Gagal memuat data."));
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const peta = useMemo(() => new Map((d?.katalog ?? []).map(s => [s.kunci, s])), [d]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (d?.butir ?? []).filter(b => !q || `${b.kode} ${b.kelompok} ${b.judul} ${b.uraian} ${b.sumber.map(k => peta.get(k)?.label ?? "").join(" ")}`.toLowerCase().includes(q));
  }, [d, cari, peta]);
  const kelompok = useMemo(() => {
    const m = new Map<string, Butir[]>();
    for (const b of tampil) m.set(b.kelompok, [...(m.get(b.kelompok) ?? []), b]);
    return [...m.entries()];
  }, [tampil]);

  async function kirim(butir: Butir[]) {
    setSimpan(true);
    const r = await fetch("/api/mutu/bukti-akreditasi", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ butir }) }).catch(() => null);
    const j = await r?.json().catch(() => null);
    setSimpan(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menyimpan."); return false; }
    toast.success("Butir tersimpan."); setSunting(null); muat(); return true;
  }
  function simpanSunting() {
    if (!sunting || !d) return;
    if (!sunting.judul.trim()) { toast.warning("Judul butir wajib diisi."); return; }
    const bersih = { ...sunting, tautan: sunting.tautan.filter(t => t.label.trim() && t.url.trim()) };
    void kirim(sunting.id ? d.butir.map(b => (b.id === sunting.id ? bersih : b)) : [...d.butir, bersih]);
  }
  async function hapus(b: Butir) {
    if (!d || !(await confirm(`Hapus butir "${b.kode ? `${b.kode} — ` : ""}${b.judul}"? Data yang ditautkan tidak ikut terhapus.`))) return;
    void kirim(d.butir.filter(x => x.id !== b.id));
  }

  if (!d && !galat) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const href = (s: Sumber) => (portal === "admin" ? s.admin : s.guru);
  const dipakai = new Set((d?.butir ?? []).flatMap(b => b.sumber));
  const kosong = [...dipakai].filter(k => peta.get(k)?.jumlah === 0).length;
  const daftarKelompok = [...new Set((d?.butir ?? []).map(b => b.kelompok))];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FolderCheck size={22} />} title="Bukti Akreditasi" description={d ? `Tahun ajaran ${d.tahunAjaran} · tiap butir menaut ke data yang sudah ada di MyAlwis` : "Butir akreditasi dan bukti datanya"} />
      {!d ? <p className="py-10 text-center text-sm text-gray-400">{galat}</p> : (
        <div className="space-y-6">
          {d.bawaan && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Daftar di bawah adalah <b>pengelompokan bukti untuk memulai</b>, bukan teks butir instrumen resmi. Sesuaikan kode, judul, dan sumber tiap butir
              dengan instrumen akreditasi yang dipakai asesor (tombol pensil), atau tambah butir baru.
            </div>
          )}
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile value={d.butir.length} label="Butir" ikon="dokumen" color="primary" />
            <StatTile value={dipakai.size} label="Sumber data terhubung" ikon="centang" color="emerald" />
            <StatTile value={kosong} label="Sumber terhubung yang datanya masih kosong" ikon="peringatan" color={kosong ? "amber" : "gray"} sorot={kosong > 0} />
            <StatTile value={d.butir.filter(b => b.sumber.length + b.tautan.length === 0).length} label="Butir tanpa bukti" ikon="waspada" color="red" />
          </div>

          <div className="baris-alat">
            <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari butir atau sumber data" /></div>
            <div className="alat-aksi"><button type="button" onClick={() => setSunting({ ...KOSONG, kelompok: daftarKelompok[0] ?? "" })} className="btn-modal-save"><Plus /> Tambah Butir</button></div>
          </div>

          {kelompok.map(([nama, butir]) => (
            <section key={nama} className="panel">
              <div className="panel-kepala"><h2 className="panel-judul">{nama}</h2><span className="text-xs text-gray-400">{butir.length} butir</span></div>
              <div className="divide-y divide-gray-100">
                {butir.map(b => (
                  <div key={b.id} className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-900">{b.kode && <span className="angka mr-2 rounded-md bg-primary-50 px-1.5 py-0.5 text-xs text-primary-700">{b.kode}</span>}{b.judul}</p>
                        {b.uraian && <p className="mt-0.5 text-sm text-gray-500">{b.uraian}</p>}
                      </div>
                      <button type="button" onClick={() => setSunting(b)} title="Ubah butir" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button type="button" onClick={() => hapus(b)} title="Hapus butir" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                    </div>
                    {b.sumber.length + b.tautan.length === 0 ? <p className="mt-2 text-sm text-gray-400">Belum ada bukti yang ditautkan.</p> : (
                      <ul className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                        {b.sumber.map(k => { const s = peta.get(k); if (!s) return null; const h = href(s); return (
                          <li key={k} className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 px-3 py-2">
                            <span className={`angka w-14 shrink-0 text-right text-base font-semibold ${s.jumlah ? "text-primary-900" : "text-amber-600"}`}>{s.jumlah === null ? "—" : s.kunci === "keterlaksanaan" ? `${s.jumlah}%` : s.jumlah.toLocaleString("id-ID")}</span>
                            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-gray-700">{s.label}</span><span className="block truncate text-xs text-gray-400">{s.kunci === "keterlaksanaan" ? "pertemuan dijurnal" : s.satuan}</span></span>
                            {h ? <Link href={h} className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900">Buka <ArrowUpRight size={12} /></Link>
                              : <span className="shrink-0 text-xs text-gray-400">di portal TU</span>}
                          </li>
                        ); })}
                        {b.tautan.map((t, i) => (
                          <li key={`t${i}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-gray-100 px-3 py-2">
                            <span className="w-14 shrink-0 text-right text-xs text-gray-400">tautan</span>
                            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700">{t.label}</span>
                            <a href={t.url} target={t.url.startsWith("/") ? undefined : "_blank"} rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900">Buka <ArrowUpRight size={12} /></a>
                          </li>
                        ))}
                      </ul>
                    )}
                    {b.catatan && <p className="mt-2 text-xs text-gray-500">Catatan: {b.catatan}</p>}
                  </div>
                ))}
              </div>
            </section>
          ))}
          {tampil.length === 0 && <p className="py-10 text-center text-sm text-gray-400">Tidak ada butir yang cocok.</p>}
          <p className="text-xs text-gray-500">Angka dihitung saat halaman dibuka. Data layanan BK dan UKS hanya ditampilkan jumlahnya; isinya tetap di menu masing-masing.</p>
        </div>
      )}

      <Modal open={!!sunting} onClose={() => !simpan && setSunting(null)} size="xl" scrollBody title={sunting?.id ? "Ubah Butir" : "Tambah Butir"}
        footer={<>
          <button type="button" onClick={() => setSunting(null)} disabled={simpan} className="btn-modal-cancel">Batal</button>
          <button type="button" onClick={simpanSunting} disabled={simpan} className="btn-modal-save">{simpan ? <Loader2 className="animate-spin" /> : <Save />} Simpan</button>
        </>}>
        {sunting && d && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div><label className="label-field" htmlFor="ba-kode">Kode butir</label><input id="ba-kode" className="input-field" maxLength={20} value={sunting.kode} onChange={e => setSunting({ ...sunting, kode: e.target.value })} placeholder="mis. 12" /></div>
              <div className="sm:col-span-2"><label className="label-field" htmlFor="ba-kel">Komponen / kelompok</label><input id="ba-kel" className="input-field" maxLength={80} list="ba-daftar-kel" value={sunting.kelompok} onChange={e => setSunting({ ...sunting, kelompok: e.target.value })} /><datalist id="ba-daftar-kel">{daftarKelompok.map(k => <option key={k} value={k} />)}</datalist></div>
            </div>
            <div><label className="label-field" htmlFor="ba-judul">Judul butir</label><input id="ba-judul" className="input-field" maxLength={200} value={sunting.judul} onChange={e => setSunting({ ...sunting, judul: e.target.value })} /></div>
            <div><label className="label-field" htmlFor="ba-uraian">Uraian</label><textarea id="ba-uraian" rows={2} className="input-field" maxLength={1000} value={sunting.uraian} onChange={e => setSunting({ ...sunting, uraian: e.target.value })} /></div>
            <div>
              <p className="label-field">Sumber data di MyAlwis</p>
              <div className="grid max-h-56 grid-cols-1 gap-x-4 gap-y-1 overflow-y-auto rounded-xl border border-gray-100 p-3 sm:grid-cols-2">
                {d.katalog.map(s => (
                  <label key={s.kunci} className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-gray-300" checked={sunting.sumber.includes(s.kunci)}
                      onChange={e => setSunting({ ...sunting, sumber: e.target.checked ? [...sunting.sumber, s.kunci] : sunting.sumber.filter(k => k !== s.kunci) })} />
                    <span className="min-w-0 truncate">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between"><p className="label-field mb-0">Tautan dokumen lain (opsional)</p>
                <button type="button" onClick={() => setSunting({ ...sunting, tautan: [...sunting.tautan, { label: "", url: "" }] })} className="text-xs font-semibold text-primary-700 hover:text-primary-900">+ Tambah tautan</button></div>
              {sunting.tautan.map((t, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input aria-label={`Nama tautan ${i + 1}`} className="input-field w-2/5" placeholder="Nama dokumen" value={t.label} onChange={e => setSunting({ ...sunting, tautan: sunting.tautan.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                  <input aria-label={`Alamat tautan ${i + 1}`} className="input-field flex-1" placeholder="https://… atau /dashboard/…" value={t.url} onChange={e => setSunting({ ...sunting, tautan: sunting.tautan.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                  <button type="button" title="Hapus tautan" onClick={() => setSunting({ ...sunting, tautan: sunting.tautan.filter((_, j) => j !== i) })} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                </div>
              ))}
              <p className="text-xs text-gray-400">Hanya alamat https atau halaman di dalam situs. Dokumen di Arsip atau Google Drive cukup ditautkan, tidak perlu diunggah ulang.</p>
            </div>
            <div><label className="label-field" htmlFor="ba-cat">Catatan</label><textarea id="ba-cat" rows={2} className="input-field" maxLength={1000} value={sunting.catatan} onChange={e => setSunting({ ...sunting, catatan: e.target.value })} /></div>
          </div>
        )}
      </Modal>
    </div>
  );
}
