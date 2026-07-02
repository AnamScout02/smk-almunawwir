"use client";
import React, { useEffect, useState, useTransition } from "react";
import { Search, Edit2, X, Save, Loader2, Briefcase, Users, CheckCircle, Clock, AlertCircle } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";

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
  ONGOING: { label: "Sedang PKL", badge: "bg-blue-50 text-blue-700 border border-blue-200", icon: Clock },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", badge: "bg-red-50 text-red-600 border border-red-200", icon: AlertCircle },
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
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Briefcase size={22} />}
        title="PKL Siswa"
        description="Praktik Kerja Lapangan — atur data tempat PKL setiap siswa"
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-heading font-bold text-primary-700">{students.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Siswa</p>
        </div>
        <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-heading font-bold text-emerald-600">{withPKL}</p>
          <p className="text-xs text-gray-400 mt-0.5">Sudah Ada PKL</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 text-center">
          <p className="text-2xl font-heading font-bold text-amber-500">{noPKL}</p>
          <p className="text-xs text-gray-400 mt-0.5">Belum Ada PKL</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, atau kelas..."
            className="input-field pl-10" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="input-field sm:w-44">
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Siswa</th>
                <th className="hidden md:table-cell">Kelas</th>
                <th>PKL</th>
                <th className="text-center">Status</th>
                <th className="text-right">Aksi</th>
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
                  <tr key={s.id}>
                    <td>
                      <p className="font-semibold text-primary-900">{s.user.name}</p>
                      <p className="text-gray-400 text-xs font-mono mt-0.5">{s.nis}</p>
                    </td>
                    <td className="text-xs hidden md:table-cell">
                      {s.class?.name
                        ? <span className="bg-primary-50 text-primary-600 font-semibold px-2 py-0.5 rounded-full border border-primary-100">{s.class.name}</span>
                        : <span className="text-amber-500">Belum ada kelas</span>}
                    </td>
                    <td>
                      {pkl ? (
                        <div>
                          <p className="font-semibold text-gray-800 text-xs">{pkl.company}</p>
                          <p className="text-gray-400 text-xs mt-0.5">{pkl.position}</p>
                          <p className="text-gray-300 text-xs mt-0.5">{fmt(pkl.startDate)} — {fmt(pkl.endDate)}</p>
                        </div>
                      ) : (
                        <span className="text-gray-300 text-xs italic">Belum diisi</span>
                      )}
                    </td>
                    <td className="text-center">
                      {statusCfg ? (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                          pkl?.status === "ONGOING" ? "bg-blue-50 text-blue-700 border-blue-200" :
                          pkl?.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                          "bg-red-50 text-red-600 border-red-200"
                        }`}>
                          <statusCfg.icon size={11} />
                          {statusCfg.label}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openEdit(s)}
                          className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary-50 border border-primary-100 hover:border-primary-200 transition-colors">
                          <Edit2 size={12} /> {pkl ? "Edit" : "Tambah"}
                        </button>
                        {pkl && (
                          <button onClick={() => handleDelete(s.id)}
                            className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100 transition-colors">
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 flex items-start justify-between"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <div>
                <h2 className="font-heading font-bold text-white">Data PKL Siswa</h2>
                <p className="text-xs text-white/50 mt-0.5">{form.studentName}</p>
              </div>
              <button onClick={() => setModal(false)} className="text-white/60 hover:text-white transition-colors mt-0.5">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 flex flex-col gap-4">
              {error && <p className="error-msg">{error}</p>}
              <div>
                <label className="label-field">Perusahaan / Instansi *</label>
                <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  placeholder="cth: PT Telkom Indonesia"
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Posisi / Jabatan *</label>
                <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))}
                  placeholder="cth: Network Engineer Intern"
                  className="input-field" />
              </div>
              <div>
                <label className="label-field">Supervisor / Pembimbing</label>
                <input value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}
                  placeholder="cth: Bapak Ahmad Fauzi"
                  className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Tanggal Mulai *</label>
                  <DatePicker value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} />
                </div>
                <div>
                  <label className="label-field">Tanggal Selesai *</label>
                  <DatePicker value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} />
                </div>
              </div>
              <div>
                <label className="label-field">Status</label>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                  className="input-field">
                  <option value="ONGOING">Sedang PKL</option>
                  <option value="COMPLETED">Selesai</option>
                  <option value="CANCELLED">Dibatalkan</option>
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
                <button type="submit" disabled={isPending} className="btn-modal-save flex-1">
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
