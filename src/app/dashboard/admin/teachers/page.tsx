"use client";
import { useEffect, useState, useTransition } from "react";
import { Search, Edit2, Save, Loader2, BookOpen, Phone, Hash, Eye, UserCog } from "lucide-react";
import Link from "next/link";
import PageHeader from "@/components/admin/PageHeader";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";

interface Teacher {
  id: string;
  nip: string;
  subject: string;
  phone: string | null;
  user: { id: string; name: string; email: string };
  homeroomOf: { id: string; name: string }[];
}

interface FormState {
  id: string;
  nip: string;
  subject: string;
  phone: string;
}

export default function AdminTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>({ id: "", nip: "", subject: "", phone: "" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/teachers");
    if (res.ok) setTeachers(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(t: Teacher) {
    setForm({ id: t.id, nip: t.nip, subject: t.subject, phone: t.phone ?? "" });
    setError("");
    setModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nip || !form.subject) { setError("NIP dan mata pelajaran wajib diisi."); return; }
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/teachers/${form.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal"); return; }
      setModal(false);
      load();
    });
  }

  const filtered = teachers.filter(t => {
    const q = search.toLowerCase();
    return !q || t.user.name.toLowerCase().includes(q) || t.nip.includes(q) || t.subject.toLowerCase().includes(q);
  });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCog size={22} />}
        title="Kelola Guru"
        description="Atur NIP, mata pelajaran, dan data profil guru"
      />

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, NIP, atau mata pelajaran..."
          className="input-field pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BookOpen} title="Tidak ada guru ditemukan" description="Tambah akun guru melalui menu Akun Pengguna." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Guru</th>
                <th className="hidden sm:table-cell">NIP</th>
                <th>Mata Pelajaran</th>
                <th className="hidden md:table-cell">Wali Kelas</th>
                <th className="hidden lg:table-cell">HP</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td>
                    <p className="font-semibold text-primary-900">{t.user.name}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{t.user.email}</p>
                  </td>
                  <td className="font-mono text-xs text-gray-500 hidden sm:table-cell">{t.nip}</td>
                  <td>
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                      <BookOpen size={13} className="text-primary-400 shrink-0" />
                      {t.subject}
                    </span>
                  </td>
                  <td className="hidden md:table-cell">
                    {t.homeroomOf.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.homeroomOf.map(c => (
                          <span key={c.id} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-semibold border border-primary-100">{c.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="text-xs text-gray-500 hidden lg:table-cell">
                    {t.phone ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/dashboard/admin/teachers/${t.id}`}
                        className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition" title="Lihat detail">
                        <Eye size={14} />
                      </Link>
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-500 transition" title="Edit">
                        <Edit2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <p className="text-xs text-gray-400 px-6 py-3 border-t border-gray-50">{filtered.length} guru terdaftar</p>
        </div>
      )}

      {/* Modal edit */}
      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Edit Profil Guru"
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="editGuruForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {isPending ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <form id="editGuruForm" onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label-field flex items-center gap-1.5">
              <Hash size={13} className="text-gray-400" /> NIP
            </label>
            <input value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))}
              className="input-field font-mono" required placeholder="18 digit NIP" />
          </div>
          <div>
            <label className="label-field flex items-center gap-1.5">
              <BookOpen size={13} className="text-gray-400" /> Mata Pelajaran Utama
            </label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              className="input-field" required placeholder="Contoh: Jaringan Komputer" />
          </div>
          <div>
            <label className="label-field flex items-center gap-1.5">
              <Phone size={13} className="text-gray-400" /> Nomor HP
            </label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="input-field" placeholder="08..." type="tel" />
          </div>
          {error && <p className="error-msg">{error}</p>}
        </form>
      </Modal>
    </div>
  );
}
