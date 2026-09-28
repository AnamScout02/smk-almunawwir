"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCheck, ClipboardCheck, Download, Loader2, Plus, ScanLine, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import Paginasi from "@/components/shared/Paginasi";
import { usePaginasi } from "@/lib/use-paginasi";
import { useToast } from "@/components/shared/ToastProvider";
import TombolKembali from "@/components/shared/TombolKembali";

interface Sesi { id: string; judul: string; status: string; olehNama: string; mulai: string; selesaiPada: string | null; jumlahItem: number; diperiksa: number }
interface Item { id: string; stokSistem: number; dipinjam: number; stokFisik: number | null; catatan: string | null; buku: { title: string; author: string | null; barcode: string | null; category: string; location: string | null } | null }

/** STOK OPNAME BUKU — pindai barcode tiap eksemplar (pemindai USB/kamera mengetik kode + Enter) atau isi jumlah manual. */
export default function StokOpnameBukuManager() {
  const toast = useToast();
  const [daftar, setDaftar] = useState<Sesi[] | null>(null);
  const [galat, setGalat] = useState("");
  const [buka, setBuka] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ opname: Sesi; item: Item[] } | null>(null);
  const [kode, setKode] = useState("");
  const [terakhir, setTerakhir] = useState<{ teks: string; ok: boolean } | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("");
  const [tutup, setTutup] = useState(false);
  const [terapkan, setTerapkan] = useState(true);
  const [sibuk, setSibuk] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const muat = useCallback(() => {
    fetch("/api/perpustakaan/opname", { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setDaftar(d.daftar);
    }).catch(() => setGalat("Gagal memuat."));
  }, []);
  useEffect(() => { muat(); }, [muat]);
  const muatDetail = useCallback((id: string) => {
    fetch(`/api/perpustakaan/opname/${id}`, { cache: "no-store" }).then(r => r.json()).then(d => { if (d.opname) setDetail(d); }).catch(() => {});
  }, []);
  useEffect(() => { if (buka) { setDetail(null); muatDetail(buka); } }, [buka, muatDetail]);

  async function pindai(e: React.FormEvent) {
    e.preventDefault();
    const k = kode.trim();
    if (!k || !buka) return;
    setKode("");
    const r = await fetch(`/api/perpustakaan/opname/${buka}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pindai: k }) }).catch(() => null);
    const d = await r?.json().catch(() => null);
    if (!r?.ok) { setTerakhir({ teks: d?.error ?? "Gagal.", ok: false }); return; }
    setTerakhir({ teks: `${d.judul}: ${d.terhitung} dari ${d.seharusnya} seharusnya di rak`, ok: d.terhitung <= d.seharusnya });
    setDetail(p => p && ({ ...p, item: p.item.map(x => (x.id === d.itemId ? { ...x, stokFisik: d.terhitung } : x)) }));
    inputRef.current?.focus();
  }
  async function ubah(itemId: string, stokFisik: string) {
    if (!buka) return;
    await fetch(`/api/perpustakaan/opname/${buka}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId, stokFisik }) }).catch(() => null);
    setDetail(p => p && ({ ...p, item: p.item.map(x => (x.id === itemId ? { ...x, stokFisik: stokFisik === "" ? null : Number(stokFisik) } : x)) }));
  }
  async function buat() {
    setSibuk(true);
    const r = await fetch("/api/perpustakaan/opname", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal."); return; }
    muat(); setBuka(d.id);
  }
  async function selesaikan() {
    if (!buka) return;
    setSibuk(true);
    const r = await fetch(`/api/perpustakaan/opname/${buka}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ terapkan }) }).catch(() => null);
    setSibuk(false);
    if (!r?.ok) { toast.error("Gagal menyelesaikan."); return; }
    toast.success(terapkan ? "Selesai; stok katalog diperbarui." : "Selesai."); setTutup(false); muatDetail(buka); muat();
  }

  const q = cari.toLowerCase();
  const baris = (detail?.item ?? []).filter(x => {
    const harus = x.stokSistem - x.dipinjam;
    return (!q || `${x.buku?.title ?? ""} ${x.buku?.barcode ?? ""} ${x.buku?.author ?? ""}`.toLowerCase().includes(q))
      && (!saring || (saring === "BELUM" ? x.stokFisik == null : saring === "SELISIH" ? x.stokFisik != null && x.stokFisik !== harus : x.stokFisik != null));
  });
  const hal = usePaginasi(baris, 50, `${cari}|${saring}|${buka}`);
  const berjalan = detail?.opname.status === "BERJALAN";

  if (buka) return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardCheck size={22} />} title={detail?.opname.judul ?? "Stok opname buku"} description={detail ? `${detail.item.filter(x => x.stokFisik != null).length}/${detail.item.length} judul terhitung · ${berjalan ? "berjalan" : "selesai"}` : "Memuat…"} />
      <div className="baris-alat mb-5">
        <div className="alat-cari"><Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" /><input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari judul, barcode…" className="input-field pl-10" /></div>
        <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[{ value: "", label: "Semua judul" }, { value: "BELUM", label: "Belum dihitung" }, { value: "SUDAH", label: "Sudah dihitung" }, { value: "SELISIH", label: "Ada selisih" }]} /></div>
        <div className="alat-aksi">
          <TombolKembali onClick={() => { setBuka(null); muat(); }} />
          <a href={`/api/perpustakaan/opname/${buka}?format=xlsx`} className="btn-modal-cancel"><Download /> Unduh Excel</a>
          {berjalan && <button type="button" onClick={() => setTutup(true)} className="btn-modal-save btn-teks"><CheckCheck /> Selesaikan</button>}
        </div>
      </div>
      {berjalan && (
        <form onSubmit={pindai} className="panel mb-5 flex flex-wrap items-center gap-3 p-4">
          <ScanLine size={20} className="text-primary-700" />
          <input ref={inputRef} autoFocus value={kode} onChange={e => setKode(e.target.value)} placeholder="Pindai barcode buku di rak (satu pindaian = satu eksemplar)" className="input-field min-w-0 flex-1" aria-label="Barcode buku" />
          <button type="submit" className="btn-modal-save btn-teks">Catat</button>
          {terakhir && <p className={`w-full text-sm ${terakhir.ok ? "text-emerald-700" : "text-red-600"}`}>{terakhir.teks}</p>}
        </form>
      )}
      {!detail ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div> : (
        <div className="panel overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Buku</th><th className="text-center">Stok</th><th className="text-center">Dipinjam</th><th className="text-center">Harus di rak</th><th>Terhitung</th></tr></thead>
            <tbody>{hal.potongan.map(x => {
              const harus = x.stokSistem - x.dipinjam;
              const beda = x.stokFisik != null && x.stokFisik !== harus;
              return (
                <tr key={x.id} className={beda ? "bg-amber-50/40" : ""}>
                  <td className="min-w-[12rem]"><p className="font-semibold text-primary-900">{x.buku?.title ?? "(terhapus)"}</p><p className="text-xs text-gray-500">{[x.buku?.barcode, x.buku?.location].filter(Boolean).join(" · ")}</p></td>
                  <td className="angka text-center">{x.stokSistem}</td><td className="angka text-center">{x.dipinjam}</td><td className="angka text-center font-semibold">{harus}</td>
                  <td><input type="number" min={0} disabled={!berjalan} aria-label={`Terhitung ${x.buku?.title ?? ""}`} defaultValue={x.stokFisik ?? ""} key={`${x.id}-${x.stokFisik}`} onBlur={e => { if (e.target.value !== String(x.stokFisik ?? "")) ubah(x.id, e.target.value); }} className={`input-field w-24 ${beda ? "border-amber-300" : ""}`} /></td>
                </tr>
              );
            })}</tbody>
          </table>
          <Paginasi hal={hal} satuan="judul" className="border-t border-gray-100" />
        </div>
      )}
      <Modal open={tutup} onClose={() => setTutup(false)} title="Selesaikan stok opname"
        footer={<><button type="button" onClick={() => setTutup(false)} className="btn-modal-cancel">Batal</button><button type="button" disabled={sibuk} onClick={selesaikan} className="btn-modal-save btn-teks"><CheckCheck /> Selesaikan</button></>}>
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={terapkan} onChange={e => setTerapkan(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300" />
          <span>Perbarui stok katalog = terhitung di rak + sedang dipinjam<span className="block text-xs text-gray-500">Judul yang belum dihitung tidak diubah. Unduh Excel dulu untuk berita acara.</span></span>
        </label>
      </Modal>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardCheck size={22} />} title="Stok Opname Buku" description="Cocokkan jumlah buku di rak dengan katalog" />
      {galat ? <EmptyState icon={ClipboardCheck} title="Tidak tersedia" description={galat} /> : !daftar ? (
        <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <>
          <div className="alat-aksi justify-end mb-5"><button type="button" disabled={sibuk} onClick={buat} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Mulai Stok Opname</button></div>
          {daftar.length === 0 ? <EmptyState icon={ClipboardCheck} title="Belum ada stok opname" description="Mulai sesi, lalu pindai barcode setiap buku di rak." /> : (
            <div className="panel overflow-hidden"><ul className="divide-y divide-gray-50">
              {daftar.map(o => (
                <li key={o.id}><button type="button" onClick={() => setBuka(o.id)} className="flex w-full flex-wrap items-center gap-2 px-5 py-4 text-left hover:bg-gray-50">
                  <span className="font-semibold text-primary-900">{o.judul}</span>
                  <span className={`status-badge ${o.status === "SELESAI" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>{o.status === "SELESAI" ? "Selesai" : "Berjalan"}</span>
                  <span className="ml-auto text-xs text-gray-500">{new Date(o.mulai).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })} · {o.olehNama} · {o.diperiksa}/{o.jumlahItem} judul</span>
                </button></li>
              ))}
            </ul></div>
          )}
        </>
      )}
    </div>
  );
}
