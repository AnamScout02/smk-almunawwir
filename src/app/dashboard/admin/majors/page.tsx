"use client";
import { useEffect, useState, useTransition } from "react";
import { Plus, Edit2, Trash2, X, Save, BookOpen, Loader2, Users, School } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";

interface Major {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string | null;
  _count: { students: number; classes: number };
}

interface FormState {
  id?: string;
  name: string;
  code: string;
  description: string;
  icon: string;
}

const emptyForm: FormState = { name: "", code: "", description: "", icon: "" };

export default function AdminMajorsPage() {
  const [majors, setMajors] = useState<Major[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/majors");
    if (res.ok) setMajors(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setError("");
    setModal(true);
  }

  function openEdit(m: Major) {
    setForm({ id: m.id, name: m.name, code: m.code, description: m.description, icon: m.icon ?? "" });
    setError("");
    setModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.description.trim()) {
      setError("Nama, kode, dan deskripsi wajib diisi.");
      return;
    }
    setError("");
    startTransition(async () => {
      const url = form.id ? `/api/admin/majors/${form.id}` : "/api/admin/majors";
      const method = form.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal"); return; }
      setModal(false);
      load();
    });
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/majors/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); alert(d.error || "Gagal menghapus"); return; }
      setDeleteConfirm(null);
      load();
    });
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Kelola Jurusan"
        description="Program keahlian yang tersedia di SMK Al Munawwir"
        actions={
          <button onClick={openCreate}
            className="inline-flex items-center gap-2 bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
            <Plus size={16} />
            Tambah Jurusan
          </button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : majors.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-gray-400">
          <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Belum ada jurusan</p>
          <p className="text-sm mt-1">Klik "Tambah Jurusan" untuk mulai menambah program keahlian.</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {majors.map((m) => (
            <div key={m.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden">
              <div className="px-5 pt-5 flex items-start gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0 shadow-sm">
                  {m.icon ? (
                    <span className="text-2xl">{m.icon}</span>
                  ) : (
                    <BookOpen size={20} className="text-primary-700" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-heading font-bold text-primary-900 text-base">{m.name}</h3>
                    <span className="bg-primary-50 text-primary-700 border border-primary-200 text-xs font-bold px-2 py-0.5 rounded-full">{m.code}</span>
                  </div>
                  <p className="text-gray-500 text-sm mt-0.5 line-clamp-2">{m.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-100 mx-5 mt-4 pt-3 pb-4">
                <span className="flex items-center gap-1">
                  <Users size={12} /> <span className="font-semibold text-primary-700">{m._count.students}</span> siswa
                </span>
                <span className="flex items-center gap-1">
                  <School size={12} /> <span className="font-semibold text-primary-700">{m._count.classes}</span> kelas
                </span>
              </div>

              <div className="flex border-t border-gray-100">
                <button onClick={() => openEdit(m)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-primary-700 hover:bg-primary-50 text-xs font-semibold px-3 py-3 transition-colors border-r border-gray-100">
                  <Edit2 size={13} /> Edit
                </button>
                <button onClick={() => setDeleteConfirm(m.id)}
                  disabled={m._count.students > 0 || m._count.classes > 0}
                  className="flex-1 flex items-center justify-center gap-1.5 text-red-500 hover:bg-red-50 text-xs font-semibold px-3 py-3 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  title={m._count.students > 0 || m._count.classes > 0 ? "Tidak bisa dihapus — masih ada siswa/kelas" : undefined}>
                  <Trash2 size={13} /> Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create/Edit */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <h2 className="font-heading font-bold text-white">
                {form.id ? "Edit Jurusan" : "Tambah Jurusan"}
              </h2>
              <button onClick={() => setModal(false)} className="text-white/60 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              {error && <p className="error-msg">{error}</p>}
              <div>
                <label className="label-field">Nama Jurusan *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="cth: Teknik Komputer dan Jaringan"
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Kode Jurusan *</label>
                <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                  placeholder="cth: TKJ"
                  maxLength={10}
                  className="input-field font-mono uppercase" />
                <p className="text-xs text-gray-400 mt-1">Kode singkat, huruf besar, maks 10 karakter.</p>
              </div>
              <div>
                <label className="label-field">Deskripsi *</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="Deskripsi singkat program keahlian..."
                  className="input-field resize-none" />
              </div>
              <div>
                <label className="label-field">Ikon (opsional)</label>
                <input value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                  placeholder="cth: 💻 atau 📊"
                  className="input-field" />
                <p className="text-xs text-gray-400 mt-1">Emoji atau simbol yang mewakili jurusan ini.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">
                  Batal
                </button>
                <button type="submit" disabled={isPending} className="btn-modal-save flex-1">
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {form.id ? "Simpan" : "Tambah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Konfirmasi hapus */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
            <Trash2 size={32} className="text-red-500 mx-auto mb-3" />
            <h3 className="font-heading font-bold text-lg text-navy mb-1">Hapus Jurusan?</h3>
            <p className="text-gray-500 text-sm mb-5">Tindakan ini tidak bisa dibatalkan.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={isPending}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60">
                {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
