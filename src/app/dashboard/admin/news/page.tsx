"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Search } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  content: string;
  thumbnail?: string;
  category: string;
  published: boolean;
  createdAt: string;
}

const emptyForm = { title: "", slug: "", content: "", thumbnail: "", category: "Umum", published: false };
const categories = ["Umum", "Prestasi", "Pengumuman", "Kegiatan", "Beasiswa", "PPDB"];

export default function AdminNewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<NewsItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/news");
    setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ ...emptyForm });
    setEditing(null); setShowForm(true); setMsg("");
  }
  function openEdit(n: NewsItem) {
    setForm({ title: n.title, slug: n.slug, content: n.content, thumbnail: n.thumbnail || "", category: n.category, published: n.published });
    setEditing(n); setShowForm(true); setMsg("");
  }

  function autoSlug(title: string) {
    return title.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, "-").replace(/(^-|-$)/g, "");
  }

  async function save() {
    if (!form.title || !form.content) { setMsg("Judul dan isi berita wajib diisi"); return; }
    setSaving(true);
    const slug = form.slug || autoSlug(form.title);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/admin/news/${editing.id}` : "/api/admin/news";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slug }) });
    if (res.ok) { setShowForm(false); load(); } else { const d = await res.json(); setMsg(d.error || "Gagal menyimpan"); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Hapus berita ini?")) return;
    await fetch(`/api/admin/news/${id}`, { method: "DELETE" });
    load();
  }

  async function togglePublish(n: NewsItem) {
    await fetch(`/api/admin/news/${n.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...n, published: !n.published }) });
    load();
  }

  const filtered = items.filter(n => n.title.toLowerCase().includes(search.toLowerCase()) || n.category.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary-900">Kelola Berita</h1>
          <p className="text-gray-500 text-sm mt-1">{items.length} berita tersimpan</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={18} /> Tulis Berita Baru
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul atau kategori..." className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 outline-none" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Tidak ada berita ditemukan</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Berita</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Kategori</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Tanggal</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(n => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {n.thumbnail && (
                          <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 hidden sm:block">
                            <Image src={n.thumbnail} alt={n.title} fill sizes="48px" className="object-cover" />
                          </div>
                        )}
                        <span className="font-medium text-gray-800 line-clamp-1">{n.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="px-2 py-1 rounded-full text-xs bg-primary-50 text-primary-700">{n.category}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">{new Date(n.createdAt).toLocaleDateString("id-ID")}</td>
                    <td className="px-4 py-3 text-center">
                      <button onClick={() => togglePublish(n)} className={`px-2.5 py-1 rounded-full text-xs font-medium ${n.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {n.published ? "Tayang" : "Draft"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {n.published && (
                          <Link href={`/news/${n.slug}`} target="_blank" className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50">
                            <Eye size={15} />
                          </Link>
                        )}
                        <button onClick={() => openEdit(n)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50"><Pencil size={15} /></button>
                        <button onClick={() => remove(n.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-heading font-bold text-primary-900">{editing ? "Edit Berita" : "Tulis Berita Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <ImageUpload value={form.thumbnail} onChange={url => setForm(f => ({ ...f, thumbnail: url }))} folder="news" label="Foto Thumbnail" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Judul Berita *</label>
                <input value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value, slug: editing ? f.slug : autoSlug(e.target.value) })); }} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none" placeholder="Judul berita..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none bg-white">
                    {categories.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Slug URL</label>
                  <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none" placeholder="judul-berita" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Isi Berita *</label>
                <textarea rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-100 outline-none resize-none" placeholder="Tulis isi berita di sini..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="w-4 h-4 rounded accent-primary-600" />
                <span className="text-sm text-gray-700">Langsung tayangkan berita ini</span>
              </label>
              {msg && <p className="text-red-500 text-sm">{msg}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan Berita"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
