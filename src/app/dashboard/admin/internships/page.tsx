"use client";
import React, { useEffect, useState, useTransition } from "react";
import { Search, Edit2, X, Save, Loader2, Briefcase, Users, CheckCircle, Clock, AlertCircle, BookOpen, Calendar, MessageSquare } from "lucide-react";
import DatePicker from "@/components/shared/DatePicker";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import Modal from "@/components/admin/Modal";
import GroupedSection from "@/components/admin/GroupedSection";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Internship {
  id: string;
  company: string;
  position: string;
  supervisor: string;
  startDate: string;
  endDate: string;
  status: string;
  teacherId: string | null;
  teacher: { user: { name: string } } | null;
}

interface TeacherOption { id: string; user: { name: string } }

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
  teacherId: string;
}

const emptyForm: FormState = {
  studentId: "", studentName: "", company: "", position: "",
  supervisor: "", startDate: "", endDate: "", status: "ONGOING", teacherId: "",
};

const PKL_STATUS: Record<string, { label: string; badge: string; icon: React.ElementType }> = {
  ONGOING: { label: "Sedang PKL", badge: "bg-blue-50 text-blue-700 border border-blue-200", icon: Clock },
  COMPLETED: { label: "Selesai", badge: "bg-emerald-50 text-emerald-700 border border-emerald-200", icon: CheckCircle },
  CANCELLED: { label: "Dibatalkan", badge: "bg-red-50 text-red-600 border border-red-200", icon: AlertCircle },
};

export default function AdminInternshipsPage() {
  const confirmDialog = useConfirm();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [journalStudent, setJournalStudent] = useState<Student | null>(null);
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/admin/internships");
    if (res.ok) setStudents(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/admin/teachers").then(r => r.json()).then(d => { if (Array.isArray(d)) setTeachers(d); }).catch(() => {});
  }, []);

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
      teacherId: pkl?.teacherId ?? "",
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
    if (!await confirmDialog("Hapus data PKL siswa ini?")) return;
    startTransition(async () => {
      await fetch(`/api/admin/internships/${studentId}`, { method: "DELETE" });
      load();
    });
  }

  const filtered = students.filter(s => {
    const q = search.toLowerCase();
    return !q || s.user.name.toLowerCase().includes(q) || s.nis.includes(q) || (s.class?.name ?? "").toLowerCase().includes(q);
  });

  const withPKL = students.filter(s => s.internship).length;
  const noPKL = students.filter(s => !s.internship).length;

  const groups = [
    { key: "ONGOING", title: "Sedang PKL", items: filtered.filter(s => s.internship?.status === "ONGOING") },
    { key: "COMPLETED", title: "Selesai", items: filtered.filter(s => s.internship?.status === "COMPLETED") },
    { key: "CANCELLED", title: "Dibatalkan", items: filtered.filter(s => s.internship?.status === "CANCELLED") },
  ].filter(g => g.items.length > 0);
  const noneGroup = filtered.filter(s => !s.internship);

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
      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile color="primary" icon={Users} value={students.length} label="Total Siswa" />
        <StatTile color="emerald" icon={CheckCircle} value={withPKL} label="Sudah Ada PKL" />
        <StatTile color="amber" icon={AlertCircle} value={noPKL} label="Belum Ada PKL" />
      </div>

      {/* Search */}
      <div className="baris-alat mb-5">
        <div className="alat-cari">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, NIS, atau kelas..."
          className="input-field pl-10" />
      </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="Tidak ada siswa yang cocok" />
      ) : (
        <div className="space-y-6">
          {groups.map(({ key, title, items }) => (
            <GroupedSection key={key} title={title} count={items.length} icon={PKL_STATUS[key].icon}>
              <InternshipTable items={items} onEdit={openEdit} onDelete={handleDelete} onJournal={setJournalStudent} fmt={fmt} />
            </GroupedSection>
          ))}
          {noneGroup.length > 0 && (
            <GroupedSection title="Belum PKL" count={noneGroup.length} icon={Users} variant="warning">
              <InternshipTable items={noneGroup} onEdit={openEdit} onDelete={handleDelete} onJournal={setJournalStudent} fmt={fmt} />
            </GroupedSection>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal scrollBody
        open={modal}
        onClose={() => setModal(false)}
        title="Data PKL Siswa"
        description={form.studentName}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="submit" form="pklForm" disabled={isPending} className="btn-modal-save flex-1">
              {isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Simpan
            </button>
          </>
        }
      >
        <form id="pklForm" onSubmit={handleSave} className="flex flex-col gap-4">
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
            <Select
              value={form.status}
              onChange={v => setForm(f => ({ ...f, status: v }))}
              options={[
                { value: "ONGOING", label: "Sedang PKL" },
                { value: "COMPLETED", label: "Selesai" },
                { value: "CANCELLED", label: "Dibatalkan" },
              ]}
            />
          </div>
          <div>
            <label className="label-field">Guru Pembimbing (sekolah)</label>
            <Select
              value={form.teacherId}
              onChange={v => setForm(f => ({ ...f, teacherId: v }))}
              options={[
                { value: "", label: "— Belum ditentukan —" },
                ...teachers.map(t => ({ value: t.id, label: t.user.name })),
              ]}
            />
          </div>
        </form>
      </Modal>

      {journalStudent && (
        <JournalModal student={journalStudent} onClose={() => setJournalStudent(null)} fmt={fmt} />
      )}
    </div>
  );
}

function JournalModal({ student, onClose, fmt }: { student: Student; onClose: () => void; fmt: (d: string) => string }) {
  interface JournalEntry { id: string; date: string; activity: string; photoUrl: string | null; teacherNote: string | null }
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/internships/${student.id}/journal`).then(r => r.json()).then(d => {
      const list: JournalEntry[] = d.journal ?? [];
      setEntries(list);
      setNotes(Object.fromEntries(list.map(e => [e.id, e.teacherNote ?? ""])));
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, [student.id]);

  async function saveNote(entryId: string) {
    setSavingId(entryId);
    await fetch(`/api/admin/internships/${student.id}/journal/${entryId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherNote: notes[entryId] || "" }),
    });
    setSavingId(null);
  }

  return (
    <Modal open onClose={onClose} title="Jurnal Harian PKL" description={`${student.user.name} — ${student.internship?.company ?? ""}`}>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-gray-400" /></div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Siswa belum mengisi jurnal harian.</p>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {entries.map(entry => (
            <div key={entry.id} className="border border-gray-100 rounded-xl p-3 flex gap-3">
              {entry.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={entry.photoUrl} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0 border border-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                  <Calendar size={11} /> {fmt(entry.date)}
                </div>
                <p className="text-sm text-gray-700 mb-2">{entry.activity}</p>
                <div className="flex gap-2">
                  <input value={notes[entry.id] ?? ""} onChange={e => setNotes(p => ({ ...p, [entry.id]: e.target.value }))}
                    placeholder="Tulis catatan untuk siswa..." className="input-field text-xs flex-1" />
                  <button onClick={() => saveNote(entry.id)} disabled={savingId === entry.id}
                    className="px-3 py-1.5 rounded-lg bg-primary-50 hover:bg-primary-100 text-primary-700 text-xs font-semibold flex items-center gap-1 shrink-0">
                    {savingId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />} Simpan
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function InternshipTable({ items, onEdit, onDelete, onJournal, fmt }: {
  items: Student[]; onEdit: (s: Student) => void; onDelete: (id: string) => void; onJournal: (s: Student) => void; fmt: (d: string) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Siswa</th>
            <th className="hidden md:table-cell">Kelas</th>
            <th>PKL</th>
            <th className="text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s) => {
            const pkl = s.internship;
            return (
              <tr key={s.id}>
                <td>
                  <p className="font-semibold text-primary-900">{s.user.name}</p>
                  <p className="text-gray-400 text-xs font-mono mt-0.5">{s.nis}</p>
                </td>
                <td className="text-xs hidden md:table-cell">
                  {s.class?.name
                    ? <span className="bg-primary-50 text-primary-700 font-semibold px-2 py-0.5 rounded-full border border-primary-100">{s.class.name}</span>
                    : <span className="text-amber-500">Belum ada kelas</span>}
                </td>
                <td>
                  {pkl ? (
                    <div>
                      <p className="font-semibold text-gray-800 text-xs">{pkl.company}</p>
                      <p className="text-gray-400 text-xs mt-0.5">{pkl.position}</p>
                      <p className="text-gray-300 text-xs mt-0.5">{fmt(pkl.startDate)} — {fmt(pkl.endDate)}</p>
                      <p className="text-xs mt-0.5">
                        {pkl.teacher
                          ? <span className="text-primary-700">Pembimbing: {pkl.teacher.user.name}</span>
                          : <span className="text-amber-500 italic">Belum ada guru pembimbing</span>}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-300 text-xs italic">Belum diisi</span>
                  )}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {pkl && (
                      <button onClick={() => onJournal(s)}
                        className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-purple-50 border border-purple-100 hover:border-purple-200 transition-colors">
                        <BookOpen size={12} /> Jurnal
                      </button>
                    )}
                    <button onClick={() => onEdit(s)}
                      className="inline-flex items-center gap-1 text-xs text-primary-700 hover:text-primary-900 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-primary-50 border border-primary-100 hover:border-primary-100 transition-colors">
                      <Edit2 size={12} /> {pkl ? "Edit" : "Tambah"}
                    </button>
                    {pkl && (
                      <button onClick={() => onDelete(s.id)}
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
  );
}
