"use client";
import { useEffect, useState } from "react";
import { Award, Loader2, Plus, Edit2, Trash2, Save } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface JabatanItem {
  id: string;
  name: string;
  _count: { teachers: number };
}

export default function AdminJabatanPage() {
  const confirmDialog = useConfirm();
  const [items, setItems] = useState<JabatanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<JabatanItem | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/admin/jabatan").then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); }).catch(() => { setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setName(""); setError(""); setModal(true); }
  function openEdit(item: JabatanItem) { setEditing(item); setName(item.name); setError(""); setModal(true); }

  async function handleSave() {
    if (!name.trim()) { setError("Nama jabatan wajib diisi."); return; }
    setSaving(true);
    const res = editing
      ? await fetch(`/api/admin/jabatan/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) })
      : await fetch("/api/admin/jabatan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  async function handleDelete(item: JabatanItem) {
    if (!await confirmDialog(`Hapus jabatan "${item.name}"? ${item._count.teachers > 0 ? `Akan dilepas dari ${item._count.teachers} guru.` : ""}`)) return;
    await fetch(`/api/admin/jabatan/${item.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Award size={22} />}
        title="Jabatan"
        description="Katalog jabatan/tugas struktural guru — bisa ditambah bebas, satu guru bisa punya beberapa jabatan"
      />

      <div className="alat-aksi justify-end mb-5">
        <button onClick={openAdd} className="btn-modal-save">
          <Plus size={15} /> Tambah Jabatan
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={Award} title="Belum Ada Jabatan" description="Tambahkan jabatan seperti Kepala Sekolah, Wakil Kepala, Guru BK, dsb." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="divide-y divide-gray-50">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-primary-50/30 transition-colors">
                <Award size={16} className="text-gold shrink-0" />
                <p className="font-semibold text-primary-900 flex-1">{item.name}</p>
                <span className="text-xs text-gray-400">{item._count.teachers} guru</span>
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition" title="Ubah">
                  <Edit2 size={14} />
                </button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah Jabatan" : "Tambah Jabatan"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <label className="label-field">Nama Jabatan</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="cth: Kepala Laboratorium" className="input-field" autoFocus />
      </Modal>
    </div>
  );
}
