"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, Search, Newspaper, X } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";

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
const categories = ["Umum", "Prestasi", "Pengumuman", "Kegiatan", "Beasiswa", "SPMB"];

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
      <PageHeader
        icon={<Newspaper size={22} />}
        title="Kelola Berita"
        description={`${items.length} berita tersimpan`}
        actions={
          <button onClick={openNew} className="btn-gold flex items-center gap-2 text-sm">
            <Plus size={18} /> Tulis Berita Baru
          </button>
        }
      />

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari judul atau kategori..." className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Tidak ada berita ditemukan</div>
          ) : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Berita</th>
                  <th className="hidden md:table-cell">Kategori</th>
                  <th className="hidden lg:table-cell">Tanggal</th>
                  <th className="text-center">Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(n => (
                  <tr key={n.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {n.thumbnail && (
                          <div className="relative w-12 h-10 rounded-lg overflow-hidden shrink-0 hidden sm:block">
                            <Image src={n.thumbnail} alt={n.title} fill sizes="48px" className="object-cover" />
                          </div>
                        )}
                        <span className="font-semibold text-primary-900 line-clamp-1">{n.title}</span>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary-50 text-primary-700 border border-primary-100">{n.category}</span>
                    </td>
                    <td className="text-gray-500 hidden lg:table-cell">{new Date(n.createdAt).toLocaleDateString("id-ID")}</td>
                    <td className="text-center">
                      <button onClick={() => togglePublish(n)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${n.published ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                        {n.published ? <Eye size={10} /> : <EyeOff size={10} />}
                        {n.published ? "Tayang" : "Draft"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        {n.published && (
                          <Link href={`/news/${n.slug}`} target="_blank" className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition">
                            <Eye size={15} />
                          </Link>
                        )}
                        <button onClick={() => openEdit(n)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"><Pencil size={15} /></button>
                        <button onClick={() => remove(n.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <h2 className="font-heading font-bold text-white">{editing ? "Edit Berita" : "Tulis Berita Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/60 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <ImageUpload value={form.thumbnail} onChange={url => setForm(f => ({ ...f, thumbnail: url }))} folder="news" label="Foto Thumbnail" />
              <div>
                <label className="label-field">Judul Berita *</label>
                <input value={form.title} onChange={e => { setForm(f => ({ ...f, title: e.target.value, slug: editing ? f.slug : autoSlug(e.target.value) })); }} className="input-field" placeholder="Judul berita..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Kategori</label>
                  <Select
                    value={form.category}
                    onChange={v => setForm(f => ({ ...f, category: v }))}
                    options={categories.map(c => ({ value: c, label: c }))}
                  />
                </div>
                <div>
                  <label className="label-field">Slug URL</label>
                  <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="input-field font-mono" placeholder="judul-berita" />
                </div>
              </div>
              <div>
                <label className="label-field">Isi Berita *</label>
                <textarea rows={8} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} className="input-field resize-none" placeholder="Tulis isi berita di sini..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.published} onChange={e => setForm(f => ({ ...f, published: e.target.checked }))} className="w-4 h-4 rounded accent-primary-600" />
                <span className="text-sm text-gray-700">Langsung tayangkan berita ini</span>
              </label>
              {msg && <p className="error-msg">{msg}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
                <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Menyimpan..." : "Simpan Berita"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
