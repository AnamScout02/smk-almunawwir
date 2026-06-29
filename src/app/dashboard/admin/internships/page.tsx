"use client";
import React, { useEffect, useState, useTransition } from "react";
import { Search, Edit2, X, Save, Loader2, Briefcase, Users, CheckCircle, Clock, AlertCircle } from "lucide-react";

interface Internship {
  id: string;
  company: string;
  position: string;
  supervisor: string;
  startDate: string;
  endDate: string;
  status: string;
}

interface Student {
  id: string;
  nis: string;
  user: { name: string; email: string };
  class: { name: string; grade: number } | null;
  major: { name: string; code: string };
  internship: Internship | null;
}

interface FormState {
  studentId: string;
  studentName: string;
  company: string;
  position: string;
  supervisor: string;
  startDate: string;
  endDate: string;
  status: string;
}

const emptyForm: FormState = {
  studentId: "", studentName: "", company: "", position: "",
  supervisor: "", startDate: "", endDate: "", status: "ONGOING",
};

const PKL_STATUS: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  ONGOING: { label: "Sedang PKL", badge: "bg-blue-100 text-blue-700", icon: Clock },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-100 text-emerald-700", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", badge: "bg-red-100 text-red-600", icon: AlertCircle },
};

export default function AdminInternshipsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/internships");
    if (res.ok) setStudents(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openEdit(s: Student) {
    const pkl = s.internship;
    setForm({
      studentId: s.id,
      studentName: s.user.name,
      company: pkl?.company ?? "",
      position: pkl?.position ?? "",
      supervisor: pkl?.supervisor ?? "",
      startDate: pkl ? new Date(pkl.startDate).toISOString().split("T")[0] : "",
      endDate: pkl ? new Date(pkl.endDate).toISOString().split("T")[0] : "",
      status: pkl?.status ?? "ONGOING",
    });
    setError("");
    setModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company.trim() || !form.position.trim() || !form.startDate || !form.endDate) {
      setError("Perusahaan, posisi, dan tanggal wajib diisi.");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await fetch(`/api/admin/internships/${form.studentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal"); return; }
      setModal(false);
      load();
    });
  }

  async function handleDelete(studentId: string) {
    if (!confirm("Hapus data PKL siswa ini?")) return;
    startTransition(async () => {
      await fetch(`/api/admin/internships/${studentId}`, { method: "DELETE" });
      load();
    });
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = !q || s.user.name.toLowerCase().includes(q) || s.nis.includes(q) || (s.class?.name ?? "").toLowerCase().includes(q);
    const matchStatus = filterStatus === "ALL" || (filterStatus === "NONE" && !s.internship) || s.internship?.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const withPKL = students.filter(s => s.internship).length;
  const noPKL = students.filter(s => !s.internship).length;

  function fmt(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-heading text-2xl font-bold text-primary-900">Kelola PKL</h1>
        <p className="text-gray-400 text-sm mt-0.5">Praktik Kerja Lapangan — atur data tempat PKL setiap siswa</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-2xl font-heading font-bold text-primary-700">{students.length}</p>
          <p className="text-xs text-gray-400">Total Siswa</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-2xl font-heading font-bold text-emerald-600">{withPKL}</p>
          <p className="text-xs text-gray-400">Sudah Ada PKL</p>
        </div>
        <div className="bg-white rounded-xl border p-3 text-center">
          <p className="text-2xl font-heading font-bold text-amber-500">{noPKL}</p>
          <p className="text-xs text-gray-400">Belum Ada PKL</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau kelas..."
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-primary-500 outline-none" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none">
          <option value="ALL">Semua Status</option>
          <option value="NONE">Belum PKL</option>
          <option value="ONGOING">Sedang PKL</option>
          <option value="COMPLETED">Selesai</option>
          <option value="CANCELLED">Dibatalkan</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">Siswa</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium hidden md:table-cell">Kelas</th>
                <th className="text-left px-4 py-3 text-gray-500 font-medium">PKL</th>
                <th className="text-center px-4 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-right px-4 py-3 text-gray-500 font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-gray-400 py-12 text-sm">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    Tidak ada siswa yang cocok
                  </td>
                </tr>
              ) : filtered.map((s) => {
                const pkl = s.internship;
                const statusCfg = pkl ? PKL_STATUS[pkl.status] : null;
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-primary-900">{s.user.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{s.nis}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell">
                      {s.class?.name ?? <span className="text-amber-500">Belum ada kelas</span>}
                    </td>
                    <td className="px-4 py-3">
                      {pkl ? (
                        <div>
                          <p className="font-medium text-gray-800 text-xs">{pkl.company}</p>
                          <p className="text-gray-400 text-xs">{pkl.position}</p>
                          <p className="text-gray-300 text-xs">{fmt(pkl.startDate)} — {fmt(pkl.endDate)}</p>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Belum diisi</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {statusCfg ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${statusCfg.badge}`}>
                          <statusCfg.icon size={11} />
                          {statusCfg.label}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary-50 transition">
                          <Edit2 size={12} /> {pkl ? "Edit" : "Tambah"}
                        </button>
                        {pkl && (
                          <button onClick={() => handleDelete(s.id)}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition">
                            <X size={12} /> Hapus
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h2 className="font-heading font-bold text-primary-900">Data PKL Siswa</h2>
                <p className="text-xs text-gray-400 mt-0.5">{form.studentName}</p>
              </div>
              <button onClick={() => setModal(false)} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl">{error}</div>}

              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Perusahaan / Instansi *</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="cth: PT Telkom Indonesia"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Posisi / Jabatan *</label>
                <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="cth: Network Engineer Intern"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none" />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Supervisor / Pembimbing</label>
                <input value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}
                  placeholder="cth: Bapak Ahmad Fauzi"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Tanggal Mulai *</label>
                  <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Tanggal Selesai *</label>
                  <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 mb-1.5 block">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-primary-500 outline-none">
                  <option value="ONGOING">Sedang PKL</option>
                  <option value="COMPLETED">Selesai</option>
                  <option value="CANCELLED">Dibatalkan</option>
                </select>
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(false)}
                  className="flex-1 border border-gray-200 text-gray-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">
                  Batal
                </button>
                <button type="submit" disabled={isPending}
                  className="flex-1 bg-primary-700 hover:bg-primary-800 text-white text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
                  {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
