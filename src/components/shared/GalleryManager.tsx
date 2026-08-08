"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Loader2, GalleryHorizontal, Search } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface GalleryItem { id: string; title: string; imageUrl: string; category: string; caption?: string; order: number; }

const emptyForm = { title: "", imageUrl: "", category: "Umum", caption: "" };
const categories = ["Umum", "Kegiatan", "Prestasi", "Fasilitas", "Pembelajaran", "Ekstrakulikuler", "Wisuda"];

export default function GalleryManager() {
  const confirmDialog = useConfirm();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/gallery");
    setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm({ ...emptyForm }); setEditing(null); setShowForm(true); setMsg(""); }
  function openEdit(item: GalleryItem) { setForm({ title: item.title, imageUrl: item.imageUrl, category: item.category, caption: item.caption || "" }); setEditing(item); setShowForm(true); setMsg(""); }

  async function save() {
    if (!form.title || !form.imageUrl) { setMsg("Judul dan foto wajib diisi"); return; }
    setSaving(true);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/admin/gallery/${editing.id}` : "/api/admin/gallery";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); load(); } else { const d = await res.json(); setMsg(d.error || "Gagal"); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!await confirmDialog("Hapus foto ini?")) return;
    await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = items
    .filter(i => !search.trim() || i.title.toLowerCase().includes(search.trim().toLowerCase()));
  const grouped = Array.from(new Set(filtered.map(i => i.category)))
    .map(cat => ({ category: cat, items: filtered.filter(i => i.category === cat) }));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<GalleryHorizontal size={22} />}
        title="Galeri Foto"
        description={`${items.length} foto tersimpan`}
      />

      <div className="flex justify-end mb-4">
        <button onClick={openNew} className="btn-gold flex items-center gap-2 text-sm">
          <Plus size={18} /> Upload Foto Baru
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari judul foto..."
          className="input-field pl-10"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={GalleryHorizontal} description="Belum ada foto" />
      ) : (
        <div className="space-y-6">
          {grouped.map(({ category, items }) => (
            <GroupedSection key={category} title={category} count={items.length} icon={GalleryHorizontal}>
              <GalleryTable items={items} onEdit={openEdit} onDelete={remove} />
            </GroupedSection>
          ))}
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Foto" : "Upload Foto Baru"}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <ImageUpload value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} folder="gallery" label="Foto *" />
          <div>
            <label className="label-field">Judul Foto *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" placeholder="Judul foto..." />
          </div>
          <div>
            <label className="label-field">Kategori</label>
            <Select
              value={form.category}
              onChange={v => setForm(f => ({ ...f, category: v }))}
              options={categories.map(c => ({ value: c, label: c }))}
            />
          </div>
          <div>
            <label className="label-field">Keterangan (opsional)</label>
            <input value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} className="input-field" placeholder="Keterangan singkat foto..." />
          </div>
          {msg && <p className="error-msg">{msg}</p>}
        </div>
      </Modal>
    </div>
  );
}

function GalleryTable({ items, onEdit, onDelete }: {
  items: GalleryItem[]; onEdit: (item: GalleryItem) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Foto</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Judul</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Keterangan</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5">
                <div className="w-14 h-14 rounded-lg border border-gray-100 overflow-hidden relative shrink-0">
                  <Image src={item.imageUrl} alt={item.title} fill sizes="56px" className="object-cover" />
                </div>
              </td>
              <td className="px-5 py-3.5 font-medium text-gray-800">{item.title}</td>
              <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{item.caption || "-"}</td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => onEdit(item)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => onDelete(item.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
