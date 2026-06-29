"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Search, Download, Upload, X, Save, BookOpen, User } from "lucide-react";

interface Teacher {
  id: string;
  nip: string;
  subject: string;
  phone?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  religion?: string;
  address?: string;
  education?: string;
  position?: string;
  startDate?: string;
  teacherStatus?: string;
  teacherNotes?: string;
  user: { name: string; email: string };
  homeroomOf: { name: string }[];
}

const STATUS_COLOR: Record<string, string> = {
  AKTIF: "bg-green-100 text-green-700",
  PENSIUN: "bg-blue-100 text-blue-700",
  KELUAR: "bg-red-100 text-red-700",
};

function Field({ label, value, onChange, type = "text", wide = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : ""}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      {type === "textarea" ? (
        <textarea
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          rows={2} value={value} onChange={e => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          value={value} onChange={e => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function BukuIndukGuruPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [filtered, setFiltered] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Teacher | null>(null);
  const [form, setForm] = useState<Partial<Teacher>>({});
  const [saving, setSaving] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: string[] } | null>(null);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/buku-induk/guru");
    const data = await res.json();
    setTeachers(data);
    setFiltered(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  useEffect(() => {
    let list = teachers;
    if (statusFilter !== "ALL") list = list.filter(t => t.teacherStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.user.name.toLowerCase().includes(q) ||
        t.nip.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [teachers, search, statusFilter]);

  function openEdit(teacher: Teacher) {
    setSelected(teacher);
    setForm({
      phone: teacher.phone ?? "",
      birthPlace: teacher.birthPlace ?? "",
      birthDate: teacher.birthDate ? teacher.birthDate.slice(0, 10) : "",
      gender: teacher.gender ?? "",
      religion: teacher.religion ?? "",
      address: teacher.address ?? "",
      education: teacher.education ?? "",
      position: teacher.position ?? "",
      startDate: teacher.startDate ? teacher.startDate.slice(0, 10) : "",
      teacherStatus: teacher.teacherStatus ?? "AKTIF",
      teacherNotes: teacher.teacherNotes ?? "",
    });
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/admin/buku-induk/guru/${selected.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSelected(null);
    fetchTeachers();
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportResult(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/admin/buku-induk/guru/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportResult(data);
    setImportLoading(false);
    fetchTeachers();
    e.target.value = "";
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="text-purple-600" size={28} />
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Buku Induk Guru</h1>
          <p className="text-sm text-gray-500">Data lengkap kepegawaian guru SMK Al-Munawwir IIBS</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-2.5 text-gray-400" />
          <input
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            placeholder="Cari nama, NIP, atau mata pelajaran..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">Semua Status</option>
          <option value="AKTIF">Aktif</option>
          <option value="PENSIUN">Pensiun</option>
          <option value="KELUAR">Keluar</option>
        </select>
        <a
          href="/api/admin/buku-induk/guru/template"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
        >
          <Download size={16} /> Download Template
        </a>
        <label className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors cursor-pointer">
          <Upload size={16} />
          {importLoading ? "Mengimpor..." : "Import Excel"}
          <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importLoading} />
        </label>
      </div>

      {/* Import result */}
      {importResult && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${importResult.errors.length > 0 ? "bg-yellow-50 border border-yellow-200" : "bg-green-50 border border-green-200"}`}>
          <p className="font-semibold">Hasil import: {importResult.created} dibuat, {importResult.updated} diperbarui</p>
          {importResult.errors.length > 0 && (
            <ul className="mt-1 text-red-600 text-xs list-disc list-inside">
              {importResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
              {importResult.errors.length > 5 && <li>...dan {importResult.errors.length - 5} error lainnya</li>}
            </ul>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">NIP</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nama Guru</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Mata Pelajaran</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Jabatan</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Wali Kelas</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-center font-semibold text-gray-600">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Memuat data...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Tidak ada data guru</td></tr>
              ) : (
                filtered.map((t, idx) => (
                  <tr key={t.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{t.nip}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{t.user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{t.subject}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{t.position ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-600">{t.homeroomOf.map(c => c.name).join(", ") || "-"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLOR[t.teacherStatus ?? "AKTIF"] ?? "bg-gray-100 text-gray-600"}`}>
                        {t.teacherStatus ?? "AKTIF"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openEdit(t)}
                        className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium"
                      >
                        Lihat/Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            Menampilkan {filtered.length} dari {teachers.length} guru
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Buku Induk Guru</h2>
                <p className="text-sm text-gray-500">{selected.user.name} — NIP {selected.nip}</p>
              </div>
              <button onClick={() => setSelected(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-center gap-2 mb-4">
                <User size={16} className="text-purple-600" />
                <h3 className="font-semibold text-gray-700">Data Kepegawaian</h3>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jenis Kelamin</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    value={String(form.gender ?? "")}
                    onChange={e => setForm(p => ({...p, gender: e.target.value}))}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="L">Laki-laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <Field label="Tempat Lahir" value={String(form.birthPlace ?? "")} onChange={v => setForm(p => ({...p, birthPlace: v}))} />
                <Field label="Tanggal Lahir" value={String(form.birthDate ?? "")} onChange={v => setForm(p => ({...p, birthDate: v}))} type="date" />
                <Field label="Agama" value={String(form.religion ?? "")} onChange={v => setForm(p => ({...p, religion: v}))} />
                <Field label="No. HP" value={String(form.phone ?? "")} onChange={v => setForm(p => ({...p, phone: v}))} />
                <Field label="Pendidikan Terakhir" value={String(form.education ?? "")} onChange={v => setForm(p => ({...p, education: v}))} />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Jabatan</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    value={String(form.position ?? "")}
                    onChange={e => setForm(p => ({...p, position: e.target.value}))}
                  >
                    <option value="">-- Pilih --</option>
                    <option value="PNS">PNS</option>
                    <option value="Guru Tetap">Guru Tetap</option>
                    <option value="GTT">GTT (Guru Tidak Tetap)</option>
                    <option value="Honorer">Honorer</option>
                    <option value="Kepala Sekolah">Kepala Sekolah</option>
                    <option value="Wakasek">Wakasek</option>
                  </select>
                </div>
                <Field label="Tanggal Mulai Mengajar" value={String(form.startDate ?? "")} onChange={v => setForm(p => ({...p, startDate: v}))} type="date" />
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    value={String(form.teacherStatus ?? "AKTIF")}
                    onChange={e => setForm(p => ({...p, teacherStatus: e.target.value}))}
                  >
                    <option value="AKTIF">AKTIF</option>
                    <option value="PENSIUN">PENSIUN</option>
                    <option value="KELUAR">KELUAR</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Alamat</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    rows={2}
                    value={String(form.address ?? "")}
                    onChange={e => setForm(p => ({...p, address: e.target.value}))}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Keterangan</label>
                  <textarea
                    className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-purple-500"
                    rows={2}
                    value={String(form.teacherNotes ?? "")}
                    onChange={e => setForm(p => ({...p, teacherNotes: e.target.value}))}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setSelected(null)}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
                Batal
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                <Save size={16} />
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
