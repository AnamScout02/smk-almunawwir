"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, Loader2, ListChecks, AlertCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { formatRupiah } from "@/lib/currency";

interface FeeType { id: string; name: string; defaultAmount: number; active: boolean }

/** Halaman "Kelola Jenis Biaya" — portal Bendahara terpisah (`/dashboard/bendahara/jenis-biaya`).
 * Dipecah dari bekas `BendaharaManager.tsx` (tab-based) — lihat catatan sama di TagihanManager.tsx. */
export default function JenisBiayaManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [types, setTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<FeeType | null>(null);
  const [form, setForm] = useState({ name: "", defaultAmount: "", active: true });
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/bendahara/fee-types").then(r => r.json()).then(d => setTypes(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditing(null);
    setForm({ name: "", defaultAmount: "", active: true });
    setModal(true);
  }
  function openEdit(t: FeeType) {
    setEditing(t);
    setForm({ name: t.name, defaultAmount: String(t.defaultAmount), active: t.active });
    setModal(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.defaultAmount) { toast.warning("Nama dan jumlah default wajib diisi."); return; }
    const amt = Number(form.defaultAmount);
    if (isNaN(amt) || amt < 0) { toast.warning("Jumlah default tidak valid."); return; }
    setSaving(true);
    const url = editing ? `/api/bendahara/fee-types/${editing.id}` : "/api/bendahara/fee-types";
    const res = await fetch(url, {
      method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, defaultAmount: amt, active: form.active }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    setModal(false); load();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus jenis biaya ini? Kalau sudah pernah dipakai bikin tagihan, akan dinonaktifkan saja (bukan dihapus).")) return;
    const res = await fetch(`/api/bendahara/fee-types/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    load();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ListChecks size={22} />} title="Kelola Jenis Biaya" description="Katalog jenis tagihan siswa — SPP, Uang Gedung, dan lainnya" />

      <div className="alat-aksi justify-end mb-5">
        <button onClick={openCreate} className="btn-modal-save"><Plus size={15} /> Tambah Jenis Biaya</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
      ) : types.length === 0 ? (
        <EmptyState icon={AlertCircle} title="Belum Ada Jenis Biaya" description="Tambahkan jenis biaya seperti SPP atau Uang Gedung untuk mulai." />
      ) : (
        <div className="panel overflow-hidden divide-y divide-gray-50">
          {types.map(t => (
            <div key={t.id} className={`flex items-center justify-between px-5 py-3.5 ${!t.active ? "opacity-40" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-primary-900">{t.name}</p>
                <p className="text-xs text-gray-400">{formatRupiah(t.defaultAmount)}{!t.active && <span className="ml-2 font-bold">(Nonaktif)</span>}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => openEdit(t)} title="Edit" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(t.id)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? "Edit Jenis Biaya" : "Tambah Jenis Biaya"} size="sm"
        footer={<>
          <button onClick={() => setModal(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={handleSave} disabled={saving} className="btn-modal-save">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Nama</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="cth: SPP" /></div>
          <div><label className="label-field">Jumlah Default (Rp)</label><input type="number" min={0} value={form.defaultAmount} onChange={e => setForm(f => ({ ...f, defaultAmount: e.target.value }))} className="input-field" /></div>
          {editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded accent-primary-700" />
              Aktif (tampil di pilihan saat buat tagihan)
            </label>
          )}
        </div>
      </Modal>
    </div>
  );
}
