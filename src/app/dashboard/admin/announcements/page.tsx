"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Bell, Loader2, AlertTriangle, Users, UserCog, GraduationCap, X } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";

interface Announcement {
  id: string;
  title: string;
  content: string;
  targetRole: string;
  priority: string;
  active: boolean;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

const emptyForm = {
  title: "",
  content: "",
  targetRole: "ALL",
  priority: "NORMAL",
  active: true,
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
};

const roleLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  ALL: { label: "Semua", color: "bg-primary-50 text-primary-700", icon: Users },
  STUDENT: { label: "Siswa", color: "bg-emerald-50 text-emerald-700", icon: GraduationCap },
  TEACHER: { label: "Guru", color: "bg-blue-50 text-blue-700", icon: UserCog },
  ADMIN: { label: "Admin", color: "bg-amber-50 text-amber-700", icon: Bell },
};

export default function AdminAnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/announcements");
    setItems(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setForm({ ...emptyForm, startDate: new Date().toISOString().slice(0, 10) });
    setEditing(null); setShowForm(true); setMsg("");
  }

  function openEdit(a: Announcement) {
    setForm({
      title: a.title,
      content: a.content,
      targetRole: a.targetRole,
      priority: a.priority,
      active: a.active,
      startDate: a.startDate.slice(0, 10),
      endDate: a.endDate ? a.endDate.slice(0, 10) : "",
    });
    setEditing(a); setShowForm(true); setMsg("");
  }

  async function save() {
    if (!form.title.trim() || !form.content.trim()) { setMsg("Judul dan isi wajib diisi"); return; }
    setSaving(true);
    const payload = { ...form, endDate: form.endDate || null };
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/admin/announcements/${editing.id}` : "/api/admin/announcements";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) { setShowForm(false); load(); } else { const d = await res.json(); setMsg(d.error || "Gagal menyimpan"); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Hapus pengumuman ini?")) return;
    await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleActive(a: Announcement) {
    await fetch(`/api/admin/announcements/${a.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...a, active: !a.active }),
    });
    load();
  }

  const active = items.filter(a => a.active);
  const inactive = items.filter(a => !a.active);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Bell size={22} />}
        title="Pengumuman"
        description={`${active.length} aktif · ${inactive.length} nonaktif`}
        actions={
          <button onClick={openNew} className="btn-gold flex items-center gap-2 text-sm">
            <Plus size={18} /> Buat Pengumuman
          </button>
        }
      />

      {/* Info Banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Bell size={18} className="text-primary-700 shrink-0 mt-0.5" />
        <p className="text-sm text-primary-800">
          Pengumuman aktif akan tampil di dashboard siswa dan/atau guru sesuai target penerima.
          Pengumuman berprioritas <strong>URGENT</strong> ditampilkan dengan warna merah mencolok.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm text-center py-16 text-gray-400">
          <Bell size={40} className="mx-auto mb-3 text-gray-200" />
          <p>Belum ada pengumuman. Buat pengumuman pertama.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Pengumuman</th>
                <th className="hidden md:table-cell">Target</th>
                <th className="hidden lg:table-cell">Berlaku s/d</th>
                <th className="text-center">Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map(a => {
                const role = roleLabels[a.targetRole] ?? roleLabels.ALL;
                const RoleIcon = role.icon;
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="flex items-start gap-2">
                        {a.priority === "URGENT" && (
                          <AlertTriangle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-semibold text-primary-900 line-clamp-1">{a.title}</p>
                          <p className="text-gray-400 text-xs line-clamp-1 mt-0.5">{a.content}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${role.color}`}>
                        <RoleIcon size={11} />
                        {role.label}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell text-xs text-gray-500">
                      {a.endDate
                        ? new Date(a.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-gray-300">Tidak ada batas</span>}
                    </td>
                    <td className="text-center">
                      <button
                        onClick={() => toggleActive(a)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${a.active ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                      >
                        {a.active ? "Aktif" : "Nonaktif"}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"><Pencil size={15} /></button>
                        <button onClick={() => remove(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between"
              style={{ background: "linear-gradient(135deg, #0A1030 0%, #0F1A45 40%, #1B2B6B 100%)" }}>
              <h2 className="font-heading font-bold text-white">{editing ? "Edit Pengumuman" : "Buat Pengumuman Baru"}</h2>
              <button onClick={() => setShowForm(false)} className="text-white/60 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label-field">Judul Pengumuman *</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input-field"
                  placeholder="Contoh: Libur Hari Raya Idul Adha 1446 H"
                />
              </div>
              <div>
                <label className="label-field">Isi Pengumuman *</label>
                <textarea
                  rows={5}
                  value={form.content}
                  onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                  className="input-field resize-none"
                  placeholder="Tulis isi pengumuman di sini..."
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Target Penerima</label>
                  <Select
                    value={form.targetRole}
                    onChange={v => setForm(f => ({ ...f, targetRole: v }))}
                    options={[
                      { value: "ALL", label: "Semua Pengguna" },
                      { value: "STUDENT", label: "Siswa" },
                      { value: "TEACHER", label: "Guru" },
                      { value: "ADMIN", label: "Admin" },
                    ]}
                  />
                </div>
                <div>
                  <label className="label-field">Prioritas</label>
                  <Select
                    value={form.priority}
                    onChange={v => setForm(f => ({ ...f, priority: v }))}
                    options={[
                      { value: "NORMAL", label: "Normal" },
                      { value: "URGENT", label: "Mendesak (Urgent)" },
                    ]}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-field">Mulai Berlaku</label>
                  <DatePicker value={form.startDate} onChange={v => setForm(f => ({ ...f, startDate: v }))} />
                </div>
                <div>
                  <label className="label-field">Berlaku s/d (opsional)</label>
                  <DatePicker value={form.endDate} onChange={v => setForm(f => ({ ...f, endDate: v }))} placeholder="Tidak ada batas" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm(f => ({ ...f, active: e.target.checked }))}
                  className="w-4 h-4 rounded accent-primary-600"
                />
                <span className="text-sm text-gray-700">Tampilkan pengumuman ini sekarang</span>
              </label>
              {msg && <p className="error-msg">{msg}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
                <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  {saving ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
