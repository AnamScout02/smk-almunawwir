"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Bell, Loader2, AlertTriangle, Users, UserCog, GraduationCap } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import GroupedSection from "@/components/admin/GroupedSection";
import { useConfirm } from "@/components/shared/ConfirmProvider";

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
  const confirmDialog = useConfirm();
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
    if (!(await confirmDialog("Hapus pengumuman ini?"))) return;
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
      />

      <div className="flex justify-end mb-5">
        <button onClick={openNew} className="btn-gold flex items-center gap-2 text-sm">
          <Plus size={18} /> Buat Pengumuman
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-primary-50 border border-primary-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
        <Bell size={18} className="text-primary-700 shrink-0 mt-0.5" />
        <p className="text-sm text-primary-900">
          Pengumuman aktif akan tampil di dashboard siswa dan/atau guru sesuai target penerima.
          Pengumuman berprioritas <strong>URGENT</strong> ditampilkan dengan warna merah mencolok.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="Belum ada pengumuman" description='Klik "Buat Pengumuman" untuk membuat pengumuman pertama' />
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <GroupedSection title="Aktif" count={active.length} icon={Bell}>
              <AnnouncementTable items={active} onEdit={openEdit} onDelete={remove} onToggle={toggleActive} />
            </GroupedSection>
          )}
          {inactive.length > 0 && (
            <GroupedSection title="Nonaktif" count={inactive.length} icon={Bell} variant="warning">
              <AnnouncementTable items={inactive} onEdit={openEdit} onDelete={remove} onToggle={toggleActive} />
            </GroupedSection>
          )}
        </div>
      )}

      {/* Modal Form */}
      <Modal scrollBody
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Pengumuman" : "Buat Pengumuman Baru"}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
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
        </div>
      </Modal>
    </div>
  );
}

function AnnouncementTable({ items, onEdit, onDelete, onToggle }: {
  items: Announcement[]; onEdit: (a: Announcement) => void; onDelete: (id: string) => void; onToggle: (a: Announcement) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-primary-100"
            style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Pengumuman</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden md:table-cell">Target</th>
            <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 hidden lg:table-cell">Berlaku s/d</th>
            <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Status</th>
            <th className="text-right px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(a => {
            const role = roleLabels[a.targetRole] ?? roleLabels.ALL;
            const RoleIcon = role.icon;
            return (
              <tr key={a.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                <td className="px-5 py-3.5">
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
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${role.color}`}>
                    <RoleIcon size={11} />
                    {role.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell text-xs text-gray-500">
                  {a.endDate
                    ? new Date(a.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                    : <span className="text-gray-300">Tidak ada batas</span>}
                </td>
                <td className="px-5 py-3.5 text-center">
                  <button
                    onClick={() => onToggle(a)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${a.active ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"}`}
                  >
                    {a.active ? "Aktif" : "Nonaktif"}
                  </button>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"><Pencil size={15} /></button>
                    <button onClick={() => onDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
