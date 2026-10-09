"use client";
import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

type Agenda = { id: string; tanggal: string; judul: string; ket: string; untuk: "PANITIA" | "SEMUA" };

/** Agenda PKL yang diketik panitia (pembekalan, rapat orang tua, batas laporan, …) — panel di halaman Kalender PKL. */
export default function AgendaPklPanel() {
  const toast = useToast(), confirm = useConfirm();
  const [a, setA] = useState<Agenda[] | null>(null);
  const [buka, setBuka] = useState(false);
  const [f, setF] = useState({ tanggal: "", judul: "", ket: "", untuk: "SEMUA" });
  const [sibuk, setSibuk] = useState(false);
  const [lama, setLama] = useState(false);
  const muat = useCallback(() => { fetch("/api/pkl/agenda").then(r => r.json()).then(d => setA(d.agenda ?? [])).catch(() => setA([])); }, []);
  useEffect(() => { muat(); }, [muat]);
  const hariIni = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const tampil = (a ?? []).filter(x => lama || x.tanggal >= hariIni);
  async function simpan() {
    setSibuk(true);
    const r = await fetch("/api/pkl/agenda", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) }).catch(() => null);
    const j = await r?.json().catch(() => ({}));
    setSibuk(false);
    if (!r?.ok) { toast.error(j?.error ?? "Gagal menyimpan agenda."); return; }
    toast.success("Agenda ditambahkan."); setBuka(false); setF({ tanggal: "", judul: "", ket: "", untuk: "SEMUA" }); muat();
  }
  async function hapus(x: Agenda) {
    if (!await confirm(`Hapus agenda "${x.judul}"?`)) return;
    const r = await fetch(`/api/pkl/agenda?id=${x.id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) { toast.success("Agenda dihapus."); muat(); } else toast.error("Gagal menghapus.");
  }
  return (
    <div className="panel overflow-hidden">
      <div className="panel-kepala">
        <p className="panel-judul">Agenda dari panitia</p>
        <button type="button" className="btn-modal-save px-3 text-xs" onClick={() => setBuka(true)}><Plus size={14} /> Tambah Agenda</button>
      </div>
      {!a ? <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
        : tampil.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada agenda. Tambahkan pembekalan, rapat orang tua, batas kumpul laporan, dan sejenisnya.</p> : (
          <ul className="divide-y divide-gray-100">
            {tampil.map(x => (
              <li key={x.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3 text-sm ${x.tanggal < hariIni ? "opacity-60" : ""}`}>
                <span className="angka w-28 shrink-0 font-medium text-primary-900">{new Date(`${x.tanggal}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
                <span className="min-w-0 flex-1 text-gray-700">{x.judul}{x.ket && <span className="block text-xs text-gray-500">{x.ket}</span>}</span>
                <span className={`status-badge shrink-0 ${x.untuk === "SEMUA" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>{x.untuk === "SEMUA" ? "Tampil ke siswa" : "Panitia saja"}</span>
                <button type="button" title="Hapus" onClick={() => hapus(x)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        )}
      {!!a?.some(x => x.tanggal < hariIni) && <p className="border-t border-gray-100 px-5 py-3 text-xs"><button type="button" className="text-primary-700 hover:underline" onClick={() => setLama(v => !v)}>{lama ? "Sembunyikan agenda yang sudah lewat" : "Tampilkan agenda yang sudah lewat"}</button></p>}
      <Modal open={buka} onClose={() => setBuka(false)} title="Tambah Agenda PKL"
        footer={<><button type="button" className="btn-modal-cancel" onClick={() => setBuka(false)}>Batal</button><button type="button" className="btn-modal-save" disabled={sibuk} onClick={simpan}>{sibuk && <Loader2 size={14} className="animate-spin" />} Simpan</button></>}>
        <div className="space-y-3">
          <div><label className="label-field">Tanggal</label><DatePicker value={f.tanggal} onChange={v => setF(s => ({ ...s, tanggal: v }))} /></div>
          <div><label className="label-field">Nama agenda</label><input className="input-field" value={f.judul} onChange={e => setF(s => ({ ...s, judul: e.target.value }))} placeholder="Mis. Pembekalan PKL kelas XI" /></div>
          <div><label className="label-field">Keterangan (boleh kosong)</label><textarea className="input-field" rows={2} value={f.ket} onChange={e => setF(s => ({ ...s, ket: e.target.value }))} placeholder="Tempat, jam, yang harus dibawa" /></div>
          <div><label className="label-field">Terlihat oleh</label><Select value={f.untuk} onChange={v => setF(s => ({ ...s, untuk: v }))} options={[{ value: "SEMUA", label: "Panitia dan siswa peserta PKL" }, { value: "PANITIA", label: "Panitia saja" }]} /></div>
        </div>
      </Modal>
    </div>
  );
}
