"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Loader2 } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface Banner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl?: string;
  linkUrl?: string;
  linkText?: string;
  order: number;
  active: boolean;
}

const empty: Omit<Banner, "id" | "order"> = {
  title: "", subtitle: "", imageUrl: "", linkUrl: "", linkText: "", active: true,
};

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Banner | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/banners");
    const data = await res.json();
    setBanners(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setForm({ ...empty }); setEditing(null); setShowForm(true); setMsg(""); }
  function openEdit(b: Banner) { setForm({ title: b.title, subtitle: b.subtitle, imageUrl: b.imageUrl || "", linkUrl: b.linkUrl || "", linkText: b.linkText || "", active: b.active }); setEditing(b); setShowForm(true); setMsg(""); }

  async function save() {
    if (!form.title || !form.subtitle) { setMsg("Judul dan subjudul wajib diisi"); return; }
    setSaving(true);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/admin/banners/${editing.id}` : "/api/admin/banners";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); load(); } else { const d = await res.json(); setMsg(d.error || "Gagal menyimpan"); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Hapus banner ini?")) return;
    await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    load();
  }

  async function toggle(b: Banner) {
    await fetch(`/api/admin/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, active: !b.active }) });
    load();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary-900">Banner / Hero Slider</h1>
          <p className="text-gray-500 text-sm mt-1">Kelola foto dan teks yang tampil di halaman utama website</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={18} /> Tambah Banner
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : banners.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg font-medium">Belum ada banner</p>
          <p className="text-sm mt-1">Klik "Tambah Banner" untuk membuat banner pertama</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {banners.map((b) => (
            <div key={b.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col sm:flex-row ${!b.active ? "opacity-60" : ""}`}>
              <div className="relative w-full sm:w-48 h-32 sm:h-auto shrink-0 bg-gray-100">
                {b.imageUrl ? (
                  <Image src={b.imageUrl} alt={b.title} fill sizes="(max-width: 640px) 100vw, 192px" className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center">
                    <span className="text-white/40 text-xs">Tanpa Foto</span>
                  </div>
                )}
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-start gap-2">
                    <GripVertical size={16} className="text-gray-300 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="font-semibold text-primary-900">{b.title}</h3>
                      <p className="text-gray-500 text-sm mt-0.5 line-clamp-2">{b.subtitle}</p>
                      {b.linkText && <span className="text-xs text-primary-600 mt-1 block">Tombol: {b.linkText}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <button onClick={() => toggle(b)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${b.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {b.active ? <><Eye size={12} /> Aktif</> : <><EyeOff size={12} /> Nonaktif</>}
                  </button>
                  <button onClick={() => openEdit(b)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => remove(b.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 hover:bg-red-100 transition-colors">
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-heading font-bold text-primary-900">{editing ? "Edit Banner" : "Tambah Banner Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <ImageUpload value={form.imageUrl} onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))} folder="banners" label="Foto Banner (opsional)" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul *</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none" placeholder="Cth: Mendidik Generasi Qurani" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subjudul / Deskripsi *</label>
                <textarea rows={3} value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none resize-none" placeholder="Deskripsi singkat yang tampil di bawah judul" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Teks Tombol</label>
                  <input value={form.linkText} onChange={e => setForm(f => ({ ...f, linkText: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none" placeholder="Cth: Daftar Sekarang" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link Tombol</label>
                  <input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none" placeholder="/admissions" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded accent-primary-600" />
                <span className="text-sm text-gray-700">Tampilkan banner ini di website</span>
              </label>
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
