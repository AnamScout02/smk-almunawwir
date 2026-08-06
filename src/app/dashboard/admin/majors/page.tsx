"use client";
import { useEffect, useState, useTransition } from "react";
import { Plus, Edit2, Trash2, Save, BookOpen, Loader2, Users, School, FileText, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import ImageUpload from "@/components/admin/ImageUpload";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import Modal from "@/components/admin/Modal";
import { themeGradient, withAlpha } from "@/lib/color";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface Major {
  id: string;
  name: string;
  code: string;
  description: string;
  icon: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  _count: { students: number; classes: number };
}

interface FormState {
  id?: string;
  name: string;
  code: string;
  description: string;
  logoUrl: string;
}

const emptyForm: FormState = { name: "", code: "", description: "", logoUrl: "" };

export default function AdminMajorsPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [majors, setMajors] = useState<Major[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

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
    setForm({ id: m.id, name: m.name, code: m.code, description: m.description, logoUrl: m.logoUrl ?? "" });
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
    if (!(await confirmDialog("Hapus jurusan ini? Tindakan ini tidak bisa dibatalkan."))) return;
    startTransition(async () => {
      const res = await fetch(`/api/admin/majors/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menghapus"); return; }
      load();
    });
  }

  const filteredMajors = majors.filter(m =>
    !search.trim() ||
    m.name.toLowerCase().includes(search.trim().toLowerCase()) ||
    m.code.toLowerCase().includes(search.trim().toLowerCase())
  );
  const withStudents = filteredMajors.filter(m => m._count.students > 0);
  const withoutStudents = filteredMajors.filter(m => m._count.students === 0);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<BookOpen size={22} />}
        title="Kelola Jurusan"
        description="Program keahlian yang tersedia di SMK Al Munawwir"
        actions={
          <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm">
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
        <EmptyState icon={BookOpen} title="Belum ada jurusan" description={'Klik "Tambah Jurusan" untuk mulai menambah program keahlian.'} />
      ) : (
        <>
          <div className="relative mb-6">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama atau kode jurusan..."
              className="input-field pl-10"
            />
          </div>
        {filteredMajors.length === 0 ? (
          <EmptyState icon={Search} title="Tidak ada jurusan ditemukan" />
        ) : (
          <div className="space-y-6">
            {withStudents.length > 0 && (
              <GroupedSection title="Jurusan Aktif" count={withStudents.length} icon={BookOpen}>
                <MajorTable items={withStudents} onEdit={openEdit} onDelete={handleDelete} />
              </GroupedSection>
            )}
            {withoutStudents.length > 0 && (
              <GroupedSection title="Belum Ada Siswa" count={withoutStudents.length} icon={BookOpen} variant="warning">
                <MajorTable items={withoutStudents} onEdit={openEdit} onDelete={handleDelete} />
              </GroupedSection>
            )}
          </div>
        )}
        </>
      )}

      {/* Modal Create/Edit */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={form.id ? "Edit Jurusan" : "Tambah Jurusan"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">
              Batal
            </button>
            <button type="submit" form="majorForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {form.id ? "Simpan" : "Tambah"}
            </button>
          </>
        }
      >
        <form id="majorForm" onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <p className="error-msg">{error}</p>}
          <ImageUpload
            value={form.logoUrl}
            onChange={(url) => setForm(f => ({ ...f, logoUrl: url }))}
            folder="majors"
            label="Logo Jurusan (opsional)"
          />
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
        </form>
      </Modal>
    </div>
  );
}

function MajorTable({ items, onEdit, onDelete }: {
  items: Major[]; onEdit: (m: Major) => void; onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Jurusan</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kode</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Deskripsi</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Siswa</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Kelas</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((m) => (
            <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl border border-primary-100 flex items-center justify-center shrink-0 overflow-hidden relative ${!m.themeColor ? "bg-primary-50" : ""}`}
                    style={{ background: m.themeColor ? themeGradient(m.themeColor) : undefined }}>
                    {m.logoUrl ? (
                      <Image src={m.logoUrl} alt={m.name} fill sizes="36px" className="object-contain p-1" unoptimized />
                    ) : (
                      <BookOpen size={16} className={m.themeColor ? "text-white" : "text-primary-700"} />
                    )}
                  </div>
                  <span className="font-semibold text-navy">{m.name}</span>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${!m.themeColor ? "bg-primary-50 text-primary-700 border-primary-200" : ""}`}
                  style={m.themeColor ? { color: m.themeColor, borderColor: withAlpha(m.themeColor, 25), background: withAlpha(m.themeColor, 6) } : undefined}>
                  {m.code}
                </span>
              </td>
              <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{m.description}</td>
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                  <Users size={12} /> {m._count.students}
                </span>
              </td>
              <td className="px-5 py-3.5">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary-700">
                  <School size={12} /> {m._count.classes}
                </span>
              </td>
              <td className="px-5 py-3.5 text-right">
                <div className="flex items-center justify-end gap-1.5">
                  <button onClick={() => onEdit(m)} className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="Edit">
                    <Edit2 size={14} />
                  </button>
                  <Link href={`/dashboard/admin/majors/${m.id}`} className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors inline-flex" title="Konten Halaman Publik">
                    <FileText size={14} />
                  </Link>
                  <button onClick={() => onDelete(m.id)}
                    disabled={m._count.students > 0 || m._count.classes > 0}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title={m._count.students > 0 || m._count.classes > 0 ? "Tidak bisa dihapus — masih ada siswa/kelas" : "Hapus"}>
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
