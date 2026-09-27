"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCheck, ClipboardList, Download, Loader2, Plus, Save, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import { KONDISI, tgl } from "@/components/sarpras/sarpras-umum";
import TombolKembali from "@/components/shared/TombolKembali";

interface Sesi { id: string; judul: string; lingkup: string; status: string; olehNama: string; mulai: string; selesaiPada: string | null; jumlahItem: number; diperiksa: number }
interface Item {
  id: string; jumlahSistem: number; kondisiSistem: string; lokasiSistem: string | null; jumlahFisik: number | null; kondisiFisik: string | null; catatan: string | null;
  asset: { name: string; category: string; kodeInventaris: string | null };
}
type Isian = { jumlahFisik: string; kondisiFisik: string; catatan: string };

/** STOK OPNAME — pencocokan jumlah & kondisi fisik aset dengan data inventaris, lalu (opsional) diterapkan. */
export default function StokOpnameManager({ lingkupLab = false }: { lingkupLab?: boolean }) {
  const toast = useToast();
  const [daftar, setDaftar] = useState<{ akses: { penuh: boolean }; daftar: Sesi[] } | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ opname: Sesi; item: Item[] } | null>(null);
  const [isian, setIsian] = useState<Record<string, Isian>>({});
  const [ubah, setUbah] = useState<Set<string>>(new Set());
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [baru, setBaru] = useState<null | { judul: string; lingkup: string }>(null);
  const [tutup, setTutup] = useState(false);
  const [terapkan, setTerapkan] = useState(true);
  const [sibuk, setSibuk] = useState(false);

  const muat = useCallback(() => {
    fetch("/api/sarpras/opname", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setDaftar(d);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const muatDetail = useCallback((id: string) => {
    setDetail(null);
    fetch(`/api/sarpras/opname/${id}`, { cache: "no-store" }).then(r => r.json()).then((d: { opname: Sesi; item: Item[] }) => {
      setDetail(d);
      setIsian(Object.fromEntries(d.item.map(x => [x.id, { jumlahFisik: x.jumlahFisik === null ? "" : String(x.jumlahFisik), kondisiFisik: x.kondisiFisik ?? "", catatan: x.catatan ?? "" }])));
      setUbah(new Set());
    }).catch(() => toast.error("Gagal memuat stok opname."));
  }, [toast]);
  useEffect(() => { if (buka) muatDetail(buka); }, [buka, muatDetail]);

  const isi = (id: string, k: keyof Isian, v: string) => { setIsian(p => ({ ...p, [id]: { ...p[id], [k]: v } })); setUbah(p => new Set(p).add(id)); };
  async function simpan() {
    if (!buka || !ubah.size) return true;
    setSibuk(true);
    const item = [...ubah].map(id => ({ id, jumlahFisik: isian[id].jumlahFisik === "" ? null : Number(isian[id].jumlahFisik), kondisiFisik: isian[id].kondisiFisik, catatan: isian[id].catatan }));
    const r = await fetch(`/api/sarpras/opname/${buka}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ item }) }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error("Gagal menyimpan hasil hitung."); return false; }
    setUbah(new Set()); toast.success(`${item.length} baris tersimpan.`);
    return true;
  }
  async function buat() {
    if (!baru) return;
    setSibuk(true);
    const r = await fetch("/api/sarpras/opname", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(baru) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal membuat."); return; }
    setBaru(null); muat(); setBuka(d.id);
  }
  async function selesaikan() {
    if (!buka || !(await simpan())) return;
    setSibuk(true);
    const r = await fetch(`/api/sarpras/opname/${buka}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terapkan }) }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error("Gagal menyelesaikan."); return; }
    toast.success(terapkan ? "Stok opname selesai; data inventaris diperbarui." : "Stok opname selesai.");
    setTutup(false); muatDetail(buka); muat();
  }

  const q = cari.toLowerCase();
  const baris = useMemo(() => (detail?.item ?? []).filter(x => {
    const s = isian[x.id];
    const selisih = s && s.jumlahFisik !== "" && (Number(s.jumlahFisik) !== x.jumlahSistem || (s.kondisiFisik && s.kondisiFisik !== x.kondisiSistem));
    return (!q || `${x.asset.name} ${x.asset.kodeInventaris ?? ""} ${x.lokasiSistem ?? ""}`.toLowerCase().includes(q))
      && (!saring || (saring === "BELUM" ? !s || s.jumlahFisik === "" : saring === "SELISIH" ? selisih : s && s.jumlahFisik !== ""));
  }), [detail, isian, q, saring]);
  const hal = usePaginasi(baris, 50, `${cari}|${saring}|${buka}`);
  const selesaiDiisi = detail ? detail.item.filter(x => isian[x.id]?.jumlahFisik !== "").length : 0;
  const berjalan = detail?.opname.status === "BERJALAN";

  if (buka) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title={detail?.opname.judul ?? "Stok Opname"}
        description={detail ? `${selesaiDiisi}/${detail.item.length} barang dihitung · ${detail.opname.status === "SELESAI" ? `selesai ${tgl(detail.opname.selesaiPada!)}` : "berjalan"}` : "Memuat…"} />
      <div className="baris-alat mb-5">
        <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari barang, kode, lokasi…" className="input-field pl-10" /></div>
        <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[{ value: "", label: "Semua barang" }, { value: "BELUM", label: "Belum dihitung" }, { value: "SUDAH", label: "Sudah dihitung" }, { value: "SELISIH", label: "Ada selisih" }]} /></div>
        <div className="alat-aksi">
          <TombolKembali onClick={async () => { if (await simpan()) { setBuka(null); setDetail(null); muat(); } }} />
          <a href={`/api/sarpras/opname/${buka}?format=xlsx`} className="btn-modal-cancel"><Download /> Unduh Excel</a>
          {berjalan && <button type="button" className="btn-modal-cancel" disabled={sibuk || !ubah.size} onClick={simpan}><Save /> Simpan{ubah.size ? ` (${ubah.size})` : ""}</button>}
          {berjalan && <button type="button" className="btn-modal-save btn-teks" disabled={sibuk} onClick={() => setTutup(true)}><CheckCheck /> Selesaikan</button>}
        </div>
      </div>
      {!detail ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>#</th><th>Barang</th><th className="text-center">Sistem</th><th>Jumlah fisik</th><th>Kondisi fisik</th><th className="hidden md:table-cell">Catatan</th></tr></thead>
            <tbody>
              {hal.potongan.map((x, i) => {
                const s = isian[x.id] ?? { jumlahFisik: "", kondisiFisik: "", catatan: "" };
                const beda = s.jumlahFisik !== "" && Number(s.jumlahFisik) !== x.jumlahSistem;
                return (
                  <tr key={x.id} className={beda ? "bg-amber-50/40" : ""}>
                    <td className="angka text-gray-500">{hal.awal + i}</td>
                    <td className="min-w-[12rem]"><p className="font-semibold text-primary-900">{x.asset.name}</p><p className="text-xs text-gray-500">{[x.asset.kodeInventaris, x.lokasiSistem ?? x.asset.category].filter(Boolean).join(" · ")}</p></td>
                    <td className="text-center text-xs whitespace-nowrap"><span className="angka font-semibold">{x.jumlahSistem}</span><br /><span className="text-gray-500">{KONDISI[x.kondisiSistem]}</span></td>
                    <td><input type="number" min={0} disabled={!berjalan} aria-label={`Jumlah fisik ${x.asset.name}`} value={s.jumlahFisik} onChange={e => isi(x.id, "jumlahFisik", e.target.value)} className={`input-field w-24 ${beda ? "border-amber-300" : ""}`} /></td>
                    <td className="min-w-[9rem]">
                      <Select value={s.kondisiFisik} onChange={v => isi(x.id, "kondisiFisik", v)} placeholder="Sama" options={[{ value: "", label: "Sama" }, ...Object.entries(KONDISI).map(([value, label]) => ({ value, label }))]} />
                    </td>
                    <td className="hidden md:table-cell"><input disabled={!berjalan} aria-label={`Catatan ${x.asset.name}`} value={s.catatan} maxLength={300} onChange={e => isi(x.id, "catatan", e.target.value)} className="input-field min-w-[10rem]" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {baris.length === 0 && <p className="px-4 py-10 text-center text-sm text-gray-400">Tidak ada barang yang cocok.</p>}
          <Paginasi hal={hal} satuan="barang" className="border-t border-gray-100" />
        </div>
      )}
      <Modal open={tutup} onClose={() => setTutup(false)} title="Selesaikan stok opname"
        footer={<><button type="button" onClick={() => setTutup(false)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={selesaikan} className="btn-modal-save btn-teks"><CheckCheck /> Selesaikan</button></>}>
        <div className="space-y-3 text-sm text-gray-700">
          <p>{selesaiDiisi} dari {detail?.item.length ?? 0} barang sudah dihitung. Barang yang belum dihitung tidak diubah.</p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={terapkan} onChange={e => setTerapkan(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
            <span>Perbarui jumlah & kondisi di data inventaris sesuai hasil hitung<span className="block text-xs text-gray-500">Unduh Excel sebelumnya untuk arsip berita acara.</span></span>
          </label>
        </div>
      </Modal>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title={lingkupLab ? "Stok Opname Lab" : "Stok Opname"} description="Cocokkan jumlah & kondisi barang di lapangan dengan data inventaris" />
      {galat ? <EmptyState icon={ClipboardList} title="Tidak tersedia" description={galat} /> : !daftar ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5">
            <button type="button" className="btn-modal-save" onClick={() => setBaru({ judul: "", lingkup: lingkupLab || !daftar.akses.penuh ? "LAB" : "SEMUA" })}><Plus /> Mulai Stok Opname</button>
          </div>
          {daftar.daftar.length === 0 ? <EmptyState icon={ClipboardList} title="Belum ada stok opname" description="Mulai sesi baru — daftar barang otomatis disiapkan dari data inventaris." /> : (
            <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
              {daftar.daftar.map(o => (
                <li key={o.id}>
                  <button type="button" onClick={() => setBuka(o.id)} className="flex w-full flex-wrap items-center gap-2 px-5 py-4 text-left hover:bg-gray-50">
                    <span className="font-semibold text-primary-900">{o.judul}</span>
                    <span className={`status-badge ${o.status === "SELESAI" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{o.status === "SELESAI" ? "Selesai" : "Berjalan"}</span>
                    {o.lingkup === "LAB" && <span className="status-badge bg-purple-50 text-purple-700 border-purple-200">Lab</span>}
                    <span className="ml-auto text-xs text-gray-500">{tgl(o.mulai)} · {o.olehNama} · {o.diperiksa}/{o.jumlahItem} dihitung</span>
                  </button>
                </li>
              ))}
            </ul></div>
          )}
        </>
      )}
      <Modal open={!!baru} onClose={() => setBaru(null)} title="Mulai stok opname"
        footer={<><button type="button" onClick={() => setBaru(null)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={buat} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Mulai</button></>}>
        {baru && (
          <div className="space-y-4">
            <div><label htmlFor="judul-opname" className="label-field">Judul</label><input id="judul-opname" className="input-field" maxLength={150} value={baru.judul} onChange={e => setBaru({ ...baru, judul: e.target.value })} placeholder="mis. Stok opname semester ganjil 2026/2027" /></div>
            {daftar?.akses.penuh && !lingkupLab && (
              <div><label className="label-field">Cakupan</label><Select value={baru.lingkup} onChange={v => setBaru({ ...baru, lingkup: v })} options={[{ value: "SEMUA", label: "Semua barang" }, { value: "LAB", label: "Barang laboratorium saja" }]} /></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
