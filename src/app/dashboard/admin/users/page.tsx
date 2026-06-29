"use client";
import { useEffect, useState, useTransition } from "react";
import { Plus, Search, Edit2, Trash2, X, Save, Eye, EyeOff, Loader2 } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  createdAt: string;
}

interface Major { id: string; name: string; code: string }
interface ClassItem { id: string; name: string; grade: number }

const ROLE_BADGE: Record<string, string> = {
  ADMIN:   "bg-purple-100 text-purple-700",
  TEACHER: "bg-blue-100 text-blue-700",
  STUDENT: "bg-emerald-100 text-emerald-700",
};
const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin", TEACHER: "Guru", STUDENT: "Siswa" };

interface FormState {
  id?: string;
  name: string; email: string; password: string;
  role: "ADMIN" | "TEACHER" | "STUDENT";
  // guru
  nip: string; subject: string; phone: string;
  // siswa
  nis: string; nisn: string; majorId: string; classId: string;
}

const emptyForm: FormState = {
  name: "", email: "", password: "", role: "STUDENT",
  nip: "", subject: "", phone: "",
  nis: "", nisn: "", majorId: "", classId: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [majors, setMajors] = useState<Major[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("Semua");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function fetchUsers() {
    setLoading(true);
    const [uRes, optRes, clsRes] = await Promise.all([
      fetch("/api/admin/users"),
      fetch("/api/admin/classes/options"),
      fetch("/api/admin/classes"),
    ]);
    if (uRes.ok) setUsers(await uRes.json());
    if (optRes.ok) { const { majors: m } = await optRes.json(); setMajors(m); }
    if (clsRes.ok) setClasses(await clsRes.json());
    setLoading(false);
  }

  useEffect(() => { fetchUsers(); }, []);

  const filtered = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === "Semua" || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  function openCreate() { setForm({ ...emptyForm, majorId: majors[0]?.id ?? "" }); setError(""); setModal(true); }
  function openEdit(u: User) { setForm({ ...emptyForm, id: u.id, name: u.name, email: u.email, role: u.role }); setError(""); setModal(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    startTransition(async () => {
      const isEdit = !!form.id;
      const url = isEdit ? `/api/admin/users/${form.id}` : "/api/admin/users";
      const method = isEdit ? "PUT" : "POST";
      const body: Record<string, string> = { name: form.name, email: form.email, role: form.role };
      if (form.password) body.password = form.password;
      if (!isEdit && form.role === "TEACHER") { body.nip = form.nip; body.subject = form.subject; body.phone = form.phone; }
      if (!isEdit && form.role === "STUDENT") { body.nis = form.nis; body.nisn = form.nisn; body.majorId = form.majorId; body.classId = form.classId; }

      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Gagal menyimpan"); return; }
      setModal(false); fetchUsers();
    });
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Hapus pengguna "${name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    fetchUsers();
  }

  const counts = { Semua: users.length, ADMIN: users.filter(u => u.role === "ADMIN").length, TEACHER: users.filter(u => u.role === "TEACHER").length, STUDENT: users.filter(u => u.role === "STUDENT").length };

  return (
    <div className="p-6 md:p-8 pt-16 lg:pt-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Akun Pengguna</h1>
          <p className="text-gray-400 text-sm mt-0.5">Kelola akun login admin, guru, dan siswa</p>
        </div>
        <button onClick={openCreate} className="btn-gold flex items-center gap-2 text-sm">
          <Plus size={16} /> Tambah Akun
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau email..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["Semua", "ADMIN", "TEACHER", "STUDENT"] as const).map(r => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition border ${roleFilter === r ? "bg-primary-900 text-white border-primary-900" : "bg-white text-gray-600 border-gray-200 hover:border-primary-300"}`}>
              {r === "Semua" ? `Semua (${counts.Semua})` : `${ROLE_LABEL[r]} (${counts[r]})`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-gray-400">Tidak ada pengguna ditemukan</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Nama</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium hidden sm:table-cell">Email</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Role</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium hidden md:table-cell">Bergabung</th>
                <th className="text-right px-6 py-3 text-gray-500 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-6 py-3.5">
                    <p className="font-semibold text-primary-900">{u.name}</p>
                    <p className="text-gray-400 text-xs sm:hidden">{u.email}</p>
                  </td>
                  <td className="px-6 py-3.5 text-gray-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-6 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_BADGE[u.role]}`}>{ROLE_LABEL[u.role]}</span>
                  </td>
                  <td className="px-6 py-3.5 text-gray-400 text-xs hidden md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => openEdit(u)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition"><Edit2 size={15} /></button>
                      <button onClick={() => handleDelete(u.id, u.name)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-3">Total: {filtered.length} pengguna</p>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="font-heading font-semibold text-primary-900">{form.id ? "Edit Akun" : "Tambah Akun"}</h2>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="label-field">Nama Lengkap</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" required />
              </div>
              <div>
                <label className="label-field">Email</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="input-field" required />
              </div>
              <div>
                <label className="label-field">{form.id ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="input-field pr-10" {...(!form.id && { required: true })} minLength={6} />
                  <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label-field">Role</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as FormState["role"] }))} className="input-field">
                  <option value="STUDENT">Siswa</option>
                  <option value="TEACHER">Guru</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              {/* Field tambahan Guru */}
              {!form.id && form.role === "TEACHER" && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profil Guru</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">NIP</label>
                      <input value={form.nip} onChange={e => setForm(f => ({ ...f, nip: e.target.value }))} className="input-field font-mono" required placeholder="18 digit" />
                    </div>
                    <div>
                      <label className="label-field">No. HP</label>
                      <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="08..." />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Mata Pelajaran Utama</label>
                    <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} className="input-field" required placeholder="Contoh: Jaringan Komputer" />
                  </div>
                </div>
              )}

              {/* Field tambahan Siswa */}
              {!form.id && form.role === "STUDENT" && (
                <div className="border-t pt-4 space-y-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Profil Siswa</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label-field">NIS</label>
                      <input value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} className="input-field font-mono" required placeholder="7 digit" />
                    </div>
                    <div>
                      <label className="label-field">NISN</label>
                      <input value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))} className="input-field font-mono" placeholder="10 digit" />
                    </div>
                  </div>
                  <div>
                    <label className="label-field">Jurusan</label>
                    <select value={form.majorId} onChange={e => setForm(f => ({ ...f, majorId: e.target.value }))} className="input-field" required>
                      <option value="">Pilih jurusan</option>
                      {majors.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label-field">Kelas</label>
                    <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))} className="input-field">
                      <option value="">— Belum ditentukan —</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              )}

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
