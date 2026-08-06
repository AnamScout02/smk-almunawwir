"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Plus, Pencil, Trash2, GripVertical, Eye, EyeOff, Loader2, Image as ImageIcon } from "lucide-react";
import ImageUpload from "@/components/admin/ImageUpload";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";

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

export default function BannerManager() {
  const confirmDialog = useConfirm();
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
    if (!await confirmDialog("Hapus banner ini?")) return;
    await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    load();
  }

  async function toggle(b: Banner) {
    await fetch(`/api/admin/banners/${b.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...b, active: !b.active }) });
    load();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ImageIcon size={22} />}
        title="Banner / Hero"
        description="Kelola foto dan teks yang tampil di halaman utama website"
        actions={
          <button onClick={openNew} className="btn-gold flex items-center gap-2 text-sm">
            <Plus size={18} /> Tambah Banner
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : banners.length === 0 ? (
        <EmptyState icon={ImageIcon} title="Belum ada banner" description={'Klik "Tambah Banner" untuk membuat banner pertama'} />
      ) : (
        <div className="grid gap-4">
          {banners.map((b) => (
            <div key={b.id} className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col sm:flex-row hover:shadow-md hover:-translate-y-0.5 transition-all ${!b.active ? "opacity-60" : ""}`}>
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
                  <button onClick={() => toggle(b)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${b.active ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}>
                    {b.active ? <><Eye size={12} /> Aktif</> : <><EyeOff size={12} /> Nonaktif</>}
                  </button>
                  <button onClick={() => openEdit(b)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 text-primary-700 hover:bg-primary-100 border border-primary-100 transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                  <button onClick={() => remove(b.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 transition-colors">
                    <Trash2 size={12} /> Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Banner" : "Tambah Banner Baru"}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <ImageUpload value={form.imageUrl} onChange={(url) => setForm(f => ({ ...f, imageUrl: url }))} folder="banners" label="Foto Banner (opsional)" />
          <div>
            <label className="label-field">Judul *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="input-field" placeholder="Cth: Mendidik Generasi Qurani" />
          </div>
          <div>
            <label className="label-field">Subjudul / Deskripsi *</label>
            <textarea rows={3} value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} className="input-field resize-none" placeholder="Deskripsi singkat yang tampil di bawah judul" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Teks Tombol</label>
              <input value={form.linkText} onChange={e => setForm(f => ({ ...f, linkText: e.target.value }))} className="input-field" placeholder="Cth: Daftar Sekarang" />
            </div>
            <div>
              <label className="label-field">Link Tombol</label>
              <input value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))} className="input-field" placeholder="/admissions" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4 rounded accent-primary-600" />
            <span className="text-sm text-gray-700">Tampilkan banner ini di website</span>
          </label>
          {msg && <p className="error-msg">{msg}</p>}
        </div>
      </Modal>
    </div>
  );
}
