"use client";
import { useEffect, useState, useTransition } from "react";
import { Search, Edit2, X, Save, Loader2, BookOpen, Phone, Hash, Eye } from "lucide-react";
import Link from "next/link";

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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Kelola Guru</h1>
        <p className="text-gray-400 text-sm mt-0.5">Atur NIP, mata pelajaran, dan data profil guru</p>
      </div>

      <div className="relative mb-5">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, NIP, atau mata pelajaran..."
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 outline-none" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center text-gray-400">
          <BookOpen size={36} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold text-navy">Tidak ada guru ditemukan</p>
          <p className="text-sm mt-1">Tambah akun guru melalui menu Akun Pengguna.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Nama Guru</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium hidden sm:table-cell">NIP</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Mata Pelajaran</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium hidden md:table-cell">Wali Kelas</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium hidden lg:table-cell">HP</th>
                <th className="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-primary-900">{t.user.name}</p>
                    <p className="text-gray-400 text-xs">{t.user.email}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-gray-600 hidden sm:table-cell">{t.nip}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                      <BookOpen size={13} className="text-primary-400" />
                      {t.subject}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    {t.homeroomOf.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.homeroomOf.map(c => (
                          <span key={c.id} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">{c.name}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs hidden lg:table-cell">
                    {t.phone ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
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
          <p className="text-xs text-gray-400 px-6 py-3 border-t">{filtered.length} guru terdaftar</p>
        </div>
      )}

      {/* Modal edit */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="font-heading font-semibold text-primary-900">Edit Profil Guru</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
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
              {error && <p className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(false)} className="flex-1 btn-outline text-sm">Batal</button>
                <button type="submit" disabled={isPending} className="flex-1 btn-gold text-sm flex items-center justify-center gap-2">
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {isPending ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
