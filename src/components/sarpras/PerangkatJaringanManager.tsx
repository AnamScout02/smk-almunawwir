"use client";
import { useCallback, useEffect, useState } from "react";
import { Router, Loader2, Plus, RefreshCw, Wifi, WifiOff, TriangleAlert, Pencil, Trash2, Search, DownloadCloud } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Baris {
  id: string; nama: string; jenis: string; mac: string; lokasi: string | null; aktif: boolean;
  ip: string | null; hidup: boolean; terlihatDetikLalu: number | null;
  padamSejak: string | null; padamMenit: number | null; catatan: string | null;
}
interface Kandidat { mac: string; ip: string; namaHost: string | null; jenis: string }
interface Data { baris: Baris[]; routerOk: boolean; kandidat: Kandidat[]; bolehKelola: boolean }

const JENIS = [
  { value: "AP", label: "Access Point (WiFi)" },
  { value: "ROUTER", label: "Router" },
  { value: "SWITCH", label: "Switch" },
  { value: "PRINTER", label: "Printer" },
  { value: "CCTV", label: "CCTV / DVR" },
  { value: "SERVER", label: "Server / NAS" },
  { value: "LAINNYA", label: "Lainnya" },
];

const lamaPadam = (m: number | null) => {
  if (m === null) return "—";
  if (m < 60) return `${m} menit`;
  if (m < 1440) return `${Math.round(m / 60)} jam`;
  return `${Math.round(m / 1440)} hari`;
};

/** PERANGKAT JARINGAN — pemantauan AP/router/switch/printer untuk Sarpras (24 September 2026).
 *
 * Tujuannya bukan "melihat jaringan" (itu sudah ada di menu Jaringan Sekolah), melainkan MENDAHULUI keluhan:
 * begitu sebuah AP padam di jam sekolah, pengelola Sarpras dapat notifikasi sebelum guru mengeluh WiFi hilang,
 * dan riwayat padamnya menunjukkan perangkat mana yang sering ngadat sehingga layak diganti. */
export default function PerangkatJaringanManager({ tanpaKerangka }: { tanpaKerangka?: boolean } = {}) {
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [sibuk, setSibuk] = useState(false);
  const [form, setForm] = useState<{ id?: string; nama: string; jenis: string; mac: string; lokasi: string; catatan: string } | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  const muat = useCallback(() => fetch("/api/sarpras/perangkat-jaringan", { cache: "no-store" })
    .then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok || !d) setGalat(d?.error || "Gagal memuat"); else { setData(d); setGalat(""); }
    })
    .catch(() => setGalat("Gagal memuat")), []);

  useEffect(() => { muat(); }, [muat]);
  useEffect(() => { const t = setInterval(muat, 30_000); return () => clearInterval(t); }, [muat]);

  const simpan = async () => {
    if (!form) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/perangkat-jaringan", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal menyimpan"); return; }
      toast.success("Tersimpan"); setForm(null); await muat();
    } finally { setSibuk(false); }
  };

  const imporSemua = async () => {
    if (!data?.kandidat.length) return;
    if (!await confirm(`Daftarkan ${data.kandidat.length} perangkat yang terdeteksi? Namanya diambil dari nama perangkat di jaringan dan bisa dirapikan setelahnya.`)) return;
    setSibuk(true);
    try {
      const r = await fetch("/api/sarpras/perangkat-jaringan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ banyak: data.kandidat.map(k => ({ mac: k.mac, namaHost: k.namaHost, ip: k.ip })) }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) { toast.error(d?.error || "Gagal mendaftarkan"); return; }
      toast.success(`${d.dibuat} perangkat didaftarkan`); await muat();
    } finally { setSibuk(false); }
  };

  const hapus = async (b: Baris) => {
    if (!await confirm(`Hapus "${b.nama}"? Riwayat padamnya ikut hilang. Kalau perangkatnya cuma dilepas sementara, lebih baik tandai tidak aktif.`)) return;
    const r = await fetch(`/api/sarpras/perangkat-jaringan?id=${encodeURIComponent(b.id)}`, { method: "DELETE" });
    if (r.ok) { toast.success("Perangkat dihapus"); muat(); } else toast.error("Gagal menghapus");
  };

  if (!data && !galat) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} flex items-center justify-center min-h-[60vh] text-gray-400`}><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <div className={`${tanpaKerangka ? "" : "p-6 lg:p-8"} text-center text-gray-400 py-20`}>{galat}</div>;

  const q = cari.trim().toLowerCase();
  const tersaring = data.baris.filter(b => !q || [b.nama, b.lokasi, b.mac, b.ip, b.jenis].some(v => (v ?? "").toLowerCase().includes(q)));
  const hidup = data.baris.filter(b => b.aktif && b.hidup).length;
  const padam = data.baris.filter(b => b.aktif && !b.hidup);

  return (
    <div className={tanpaKerangka ? "" : "p-6 lg:p-8 pt-16 lg:pt-8"}>
      {!tanpaKerangka && (
      <PageHeader icon={<Router size={22} />} title="Perangkat Jaringan"
        description="Access point, router, switch, dan perangkat tetap lain — padam di jam sekolah langsung diberitahukan" />
      )}

      {!data.routerOk && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 flex gap-2">
          <TriangleAlert size={18} className="shrink-0 text-amber-600" />
          <span>Router tidak bisa dihubungi, jadi status hidup/mati belum bisa dibaca. Daftarnya tetap tampil.</span>
        </div>
      )}

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile ikon="perisai" color="primary" value={data.baris.filter(b => b.aktif).length} label="Perangkat dipantau" />
        <StatTile ikon="hadir" color="emerald" value={hidup} label="Hidup" />
        <StatTile ikon="peringatan" color={padam.length ? "red" : "gray"} value={padam.length} label="Padam" sorot={padam.length > 0} />
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, lokasi, MAC, atau IP..." className="input-field pl-10" />
        </div>
        <div className="alat-aksi">
          <button type="button" onClick={muat} className="btn-modal-cancel"><RefreshCw /> Muat ulang</button>
          {data.bolehKelola && data.kandidat.length > 0 && (
            <button type="button" disabled={sibuk} onClick={imporSemua} className="btn-modal-cancel btn-teks">
              <DownloadCloud /> Daftarkan {data.kandidat.length} terdeteksi
            </button>
          )}
          {data.bolehKelola && (
            <button type="button" onClick={() => setForm({ nama: "", jenis: "AP", mac: "", lokasi: "", catatan: "" })} className="btn-modal-save"><Plus /> Tambah</button>
          )}
        </div>
      </div>

      <div className="panel overflow-hidden">
        {tersaring.length === 0 ? (
          <EmptyState icon={Router} title="Belum ada perangkat dipantau"
            description="Tekan &quot;Daftarkan terdeteksi&quot; untuk mengambil access point dan router yang sudah terlihat di jaringan sekolah." />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Nama</th><th>Jenis</th><th>Lokasi</th><th>Status</th><th>IP</th><th>Lama padam</th><th></th></tr></thead>
              <tbody>
                {tersaring.map(b => (
                  <tr key={b.id} className={b.aktif ? "" : "opacity-50"}>
                    <td className="font-medium text-primary-900 whitespace-nowrap">
                      {b.nama}
                      <span className="block font-mono text-xs font-normal text-gray-400">{b.mac}</span>
                    </td>
                    <td className="text-xs text-gray-600">{JENIS.find(j => j.value === b.jenis)?.label ?? b.jenis}</td>
                    <td className="text-sm text-gray-600">{b.lokasi ?? "—"}</td>
                    <td>
                      <span className={`status-badge ${b.hidup ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                        {b.hidup ? <Wifi size={12} /> : <WifiOff size={12} />} {b.hidup ? "Hidup" : "Padam"}
                      </span>
                    </td>
                    <td className="font-mono text-xs">{b.ip ?? "—"}</td>
                    <td className="text-xs text-gray-500">{lamaPadam(b.padamMenit)}</td>
                    <td className="text-right whitespace-nowrap">
                      {data.bolehKelola && <>
                        <button onClick={() => setForm({ id: b.id, nama: b.nama, jenis: b.jenis, mac: b.mac, lokasi: b.lokasi ?? "", catatan: b.catatan ?? "" })} title="Ubah" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => hapus(b)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                      </>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? "Ubah perangkat" : "Tambah perangkat"} size="md" scrollBody
        footer={<>
          <button type="button" onClick={() => setForm(null)} className="btn-modal-cancel">Batal</button>
          <button type="button" disabled={sibuk} onClick={simpan} className="btn-modal-save">{sibuk ? <Loader2 className="animate-spin" /> : <Plus />} Simpan</button>
        </>}>
        {form && (
          <div className="space-y-4">
            <div>
              <label className="label-field">Nama</label>
              <input value={form.nama} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="AP Ruang XI TKJ 2" className="input-field" />
            </div>
            <div>
              <label className="label-field">Jenis</label>
              <Select value={form.jenis} onChange={v => setForm({ ...form, jenis: v })} options={JENIS} />
            </div>
            <div>
              <label className="label-field">Lokasi</label>
              <input value={form.lokasi} onChange={e => setForm({ ...form, lokasi: e.target.value })} placeholder="Gedung A lantai 2" className="input-field" />
            </div>
            <div>
              <label className="label-field">MAC</label>
              <input value={form.mac} onChange={e => setForm({ ...form, mac: e.target.value.toUpperCase() })} placeholder="70:85:C4:C2:12:32" className="input-field font-mono" disabled={!!form.id} />
            </div>
            <div>
              <label className="label-field">Catatan (opsional)</label>
              <input value={form.catatan} onChange={e => setForm({ ...form, catatan: e.target.value })} className="input-field" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
