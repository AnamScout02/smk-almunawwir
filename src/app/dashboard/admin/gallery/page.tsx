"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface GalleryItem { id: string; title: string; imageUrl: string; category: string; caption?: string; order: number; }

const emptyForm = { title: "", imageUrl: "", category: "Umum", caption: "" };
const categories = ["Umum", "Kegiatan", "Prestasi", "Fasilitas", "Pembelajaran", "Ekstrakulikuler", "Wisuda"];

export default function AdminGalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<GalleryItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [filter, setFilter] = useState("Semua");

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
    if (!confirm("Hapus foto ini?")) return;
    await fetch(`/api/admin/gallery/${id}`, { method: "DELETE" });
    load();
  }

  const allCats = ["Semua", ...Array.from(new Set(items.map(i => i.category)))];
  const filtered = filter === "Semua" ? items : items.filter(i => i.category === filter);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary-900">Galeri Foto</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} foto tersimpan</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start">
          <Plus size={18} /> Upload Foto Baru
        </button>
      </div>

      <div className="flex gap-2 flex-wrap mb-5">
        {allCats.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filter === c ? "bg-primary-700 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{c}</button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Belum ada foto di kategori ini</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="group relative bg-white rounded-2xl overflow-hidden border shadow-sm hover:shadow-md transition-shadow">
              <div className="relative aspect-square">
                <Image src={item.imageUrl} alt={item.title} fill sizes="(max-width: 640px) 50vw, 33vw" className="object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                  <button onClick={() => openEdit(item)} className="p-2 bg-white/90 rounded-lg text-blue-600 hover:bg-white"><Pencil size={15} /></button>
                  <button onClick={() => remove(item.id)} className="p-2 bg-white/90 rounded-lg text-red-600 hover:bg-white"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                <span className="text-xs text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{item.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-8 shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-heading font-bold text-primary-900">{editing ? "Edit Foto" : "Upload Foto Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <ImageUpload value={form.imageUrl} onChange={url => setForm(f => ({ ...f, imageUrl: url }))} folder="gallery" label="Foto *" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Foto *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none" placeholder="Judul foto..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none bg-white">
                  {categories.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (opsional)</label>
                <input value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none" placeholder="Keterangan singkat foto..." />
              </div>
              {msg && <p className="text-red-500 text-sm">{msg}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
