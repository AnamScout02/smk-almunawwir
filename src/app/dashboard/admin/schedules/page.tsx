"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Calendar, Loader2, ChevronDown } from "lucide-react";

interface ClassItem { id: string; name: string; grade: number; major: { name: string } }
interface TeacherItem { id: string; subject: string; user: { name: string } }
interface ScheduleItem {
  id: string; classId: string; teacherId: string | null; subject: string;
  day: string; startTime: string; endTime: string; room: string | null;
  class: { name: string; major: { name: string } };
  teacher: { user: { name: string } } | null;
}

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = {
  SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu",
  KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu",
};
const DAY_COLOR: Record<string, string> = {
  SENIN: "bg-blue-50 border-blue-200 text-blue-800",
  SELASA: "bg-emerald-50 border-emerald-200 text-emerald-800",
  RABU: "bg-amber-50 border-amber-200 text-amber-800",
  KAMIS: "bg-purple-50 border-purple-200 text-purple-800",
  JUMAT: "bg-rose-50 border-rose-200 text-rose-800",
  SABTU: "bg-gray-50 border-gray-200 text-gray-700",
};

const emptyForm = { classId: "", teacherId: "", subject: "", day: "SENIN", startTime: "07:00", endTime: "08:30", room: "" };

export default function AdminSchedulesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/classes").then(r => r.json()),
      fetch("/api/admin/teachers").then(r => r.json()),
    ]).then(([cls, tch]) => {
      setClasses(cls);
      setTeachers(tch);
      if (cls.length > 0) setSelectedClass(cls[0].id);
    });
  }, []);

  const loadSchedules = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    const res = await fetch(`/api/admin/schedules?classId=${classId}`);
    setSchedules(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (selectedClass) loadSchedules(selectedClass);
  }, [selectedClass, loadSchedules]);

  function openNew() {
    setForm({ ...emptyForm, classId: selectedClass });
    setEditing(null); setShowForm(true); setMsg("");
  }
  function openEdit(s: ScheduleItem) {
    setForm({ classId: s.classId, teacherId: s.teacherId ?? "", subject: s.subject, day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room ?? "" });
    setEditing(s); setShowForm(true); setMsg("");
  }

  async function save() {
    if (!form.classId || !form.subject || !form.day || !form.startTime || !form.endTime) { setMsg("Data tidak lengkap"); return; }
    setSaving(true);
    const method = editing ? "PUT" : "POST";
    const url = editing ? `/api/admin/schedules/${editing.id}` : "/api/admin/schedules";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) { setShowForm(false); loadSchedules(selectedClass); }
    else { const d = await res.json(); setMsg(d.error || "Gagal menyimpan"); }
    setSaving(false);
  }

  async function remove(id: string) {
    if (!confirm("Hapus jadwal ini?")) return;
    await fetch(`/api/admin/schedules/${id}`, { method: "DELETE" });
    loadSchedules(selectedClass);
  }

  const byDay = DAYS.reduce<Record<string, ScheduleItem[]>>((acc, d) => {
    acc[d] = schedules.filter(s => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  const activeClass = classes.find(c => c.id === selectedClass);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-heading font-bold text-primary-900">Jadwal Pelajaran</h1>
          <p className="text-gray-500 text-sm mt-1">{schedules.length} jam pelajaran terjadwal</p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={18} /> Tambah Jadwal
        </button>
      </div>

      {/* Class Selector */}
      <div className="bg-white rounded-2xl border shadow-sm p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
        <div className="relative inline-block">
          <select
            value={selectedClass}
            onChange={e => setSelectedClass(e.target.value)}
            className="appearance-none bg-primary-50 border border-primary-200 text-primary-900 font-semibold rounded-xl pl-4 pr-10 py-2.5 text-sm focus:border-primary-500 outline-none cursor-pointer"
          >
            {classes.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.major.name}
              </option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-700 pointer-events-none" />
        </div>
        {activeClass && (
          <span className="ml-3 text-xs text-gray-500">
            Kelas {activeClass.grade} · {activeClass.major.name}
          </span>
        )}
      </div>

      {/* Timetable */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS.map(day => (
            <div key={day} className={`rounded-2xl border-2 ${DAY_COLOR[day]} overflow-hidden`}>
              <div className={`px-4 py-3 flex items-center justify-between`}>
                <h3 className="font-heading font-bold text-sm">{DAY_LABEL[day]}</h3>
                <span className="text-xs opacity-70">{byDay[day].length} jam</span>
              </div>
              <div className="bg-white divide-y divide-gray-50">
                {byDay[day].length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400 text-center">Tidak ada jadwal</p>
                ) : byDay[day].map(s => (
                  <div key={s.id} className="px-4 py-3 flex items-start justify-between group hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-bold text-primary-700 font-mono">{s.startTime}–{s.endTime}</span>
                        {s.room && <span className="text-xs text-gray-400">{s.room}</span>}
                      </div>
                      <p className="font-semibold text-sm text-gray-800 truncate">{s.subject}</p>
                      {s.teacher && <p className="text-xs text-gray-400 truncate">{s.teacher.user.name}</p>}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                      <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Pencil size={13} /></button>
                      <button onClick={() => remove(s.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-md my-8 shadow-2xl">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="font-heading font-bold text-primary-900 flex items-center gap-2">
                <Calendar size={18} /> {editing ? "Edit Jadwal" : "Tambah Jadwal"}
              </h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kelas *</label>
                <select value={form.classId} onChange={e => setForm(f => ({ ...f, classId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none bg-white">
                  <option value="">Pilih kelas...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.major.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mata Pelajaran *</label>
                <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none"
                  placeholder="Matematika, Bahasa Indonesia, dll." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Guru (opsional)</label>
                <select value={form.teacherId} onChange={e => setForm(f => ({ ...f, teacherId: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none bg-white">
                  <option value="">-- Pilih guru --</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.user.name} ({t.subject})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hari *</label>
                  <select value={form.day} onChange={e => setForm(f => ({ ...f, day: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none bg-white">
                    {DAYS.map(d => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ruang</label>
                  <input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none"
                    placeholder="Lab-1, R.12, dll." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jam Mulai *</label>
                  <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jam Selesai *</label>
                  <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:border-primary-500 outline-none" />
                </div>
              </div>
              {msg && <p className="text-red-500 text-sm">{msg}</p>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-xl border text-sm text-gray-600 hover:bg-gray-50">Batal</button>
              <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
