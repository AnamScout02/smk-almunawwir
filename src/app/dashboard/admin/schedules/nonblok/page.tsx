"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, CalendarDays, Loader2, Wand2, Printer, ArrowLeft, CheckCircle2, AlertTriangle, Table2, ChevronDown, ChevronUp } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import Alert from "@/components/admin/Alert";
import { colorForTeacherCode } from "@/lib/teacher-colors";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface ClassItem { id: string; name: string; grade: number; major: { id: string; name: string } }
interface TeacherItem { id: string; subject: string; user: { name: string } }
interface SubjectItem { id: string; code: number; name: string; grade: number; majorId: string | null }
interface ScheduleItem {
  id: string; classId: string; teacherId: string | null; subject: string;
  day: string; startTime: string; endTime: string; room: string | null;
  class: { name: string; major: { name: string } };
  teacher: { user: { name: string } } | null;
}
interface GenerateReport {
  created: number;
  classesProcessed: number;
  unscheduled: { className: string; subjectName: string; teacherName: string; missingHours: number }[];
}
interface AssignmentCode { classId: string; subjectId: string; teacherId: string; subject: { name: string; code: number }; teacher: { shortCode: string | null } }
interface PeriodItem { id: string; day: string; order: number; startTime: string; endTime: string; isBreak: boolean; label?: string | null }

const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

const emptyForm = { classId: "", teacherId: "", subject: "", day: "SENIN", startTime: "07:15", endTime: "07:45" };

export default function NonBlokSchedulePage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateReport, setGenerateReport] = useState<GenerateReport | null>(null);
  const [allSchedules, setAllSchedules] = useState<ScheduleItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentCode[]>([]);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [showGrid, setShowGrid] = useState(true);

  const loadSchedules = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/schedules?classId=${classId}&scheduleType=NONBLOK`);
      setSchedules(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    const [allSched, assign] = await Promise.all([
      fetch("/api/admin/schedules?scheduleType=NONBLOK").then(r => r.json()),
      fetch("/api/admin/teaching-assignments").then(r => r.json()),
    ]);
    setAllSchedules(Array.isArray(allSched) ? allSched : []);
    setAssignments(Array.isArray(assign) ? assign : []);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/classes").then(r => r.json()),
      fetch("/api/admin/teachers").then(r => r.json()),
      fetch("/api/admin/subjects").then(r => r.json()),
      fetch("/api/admin/school-periods").then(r => r.json()),
    ]).then(([cls, tch, subj, per]) => {
      setClasses(cls);
      setTeachers(tch);
      setSubjects(Array.isArray(subj) ? subj : []);
      setPeriods(Array.isArray(per) ? per : []);
      if (cls.length > 0) setSelectedClass(cls[0].id);
    });
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedClass) loadSchedules(selectedClass);
  }, [selectedClass, loadSchedules]);

  async function runGenerate(scope: "class" | "all") {
    setGenerating(true);
    setGenerateReport(null);
    try {
      const body = scope === "class" ? { classIds: [selectedClass] } : {};
      const res = await fetch("/api/admin/schedules/generate-nonblok", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal generate jadwal non-blok"); return; }
      setGenerateReport(data);
      if (selectedClass) loadSchedules(selectedClass);
      loadAll();
    } catch {
      toast.error("Gagal generate — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setGenerating(false);
    }
  }

  function openNew() {
    setForm({ ...emptyForm, classId: selectedClass });
    setEditing(null); setShowForm(true); setMsg("");
  }
  function openEdit(s: ScheduleItem) {
    setForm({ classId: s.classId, teacherId: s.teacherId ?? "", subject: s.subject, day: s.day, startTime: s.startTime, endTime: s.endTime });
    setEditing(s); setShowForm(true); setMsg("");
  }
  async function saveForm() {
    setSaving(true); setMsg("");
    try {
      const url = editing ? `/api/admin/schedules/${editing.id}` : "/api/admin/schedules";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, weekType: "SEMUA", scheduleType: "NONBLOK" }),
      });
      if (res.ok) { setShowForm(false); loadSchedules(selectedClass); loadAll(); }
      else { const d = await res.json(); setMsg(d.error || "Gagal menyimpan"); }
    } catch {
      setMsg("Gagal menyimpan — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setSaving(false);
    }
  }
  async function remove(id: string) {
    if (!(await confirmDialog("Hapus jadwal ini?"))) return;
    await fetch(`/api/admin/schedules/${id}`, { method: "DELETE" });
    loadSchedules(selectedClass);
    loadAll();
  }

  const byDay = DAYS.reduce<Record<string, ScheduleItem[]>>((acc, d) => {
    acc[d] = schedules.filter(s => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
    return acc;
  }, {} as Record<string, ScheduleItem[]>);

  const activeClass = classes.find(c => c.id === selectedClass);
  const subjectOptions = activeClass
    ? subjects
        .filter(s => s.grade === activeClass.grade)
        .filter(s => !s.majorId || s.majorId === activeClass.major.id)
        .map(s => ({ value: s.name, label: `${s.code} — ${s.name}` }))
    : [];

  function renderScheduleGrid() {
    const gridClasses = [...classes].sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));

    const codeIndex = new Map<string, { teacherCode: string; subjectCode: number }>();
    for (const a of assignments) {
      codeIndex.set(`${a.classId}|${a.subject.name}`, { teacherCode: a.teacher.shortCode ?? "?", subjectCode: a.subject.code });
    }
    const scheduleIndex = new Map<string, ScheduleItem>();
    for (const s of allSchedules) scheduleIndex.set(`${s.classId}|${s.day}|${s.startTime}`, s);

    const periodsByDay = new Map<string, PeriodItem[]>();
    for (const d of DAYS) {
      const seen = new Set<string>();
      periodsByDay.set(d, periods.filter(p => p.day === d && (seen.has(p.startTime) ? false : (seen.add(p.startTime), true))).sort((a, b) => a.order - b.order));
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <button onClick={() => setShowGrid(v => !v)} className="w-full px-3 py-2 flex items-center justify-between border-b border-gray-100">
          <span className="flex items-center gap-1.5 text-xs font-bold text-primary-900">
            <Table2 size={14} /> Tabel Jadwal Non-Blok (Live) — 1 Minggu
          </span>
          {showGrid ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
        </button>
        {showGrid && (
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-[9px] border-collapse w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 bg-primary-900 text-white px-1 py-1 z-20 min-w-[36px]">Hari</th>
                  <th className="sticky top-0 bg-primary-900 text-white px-1 py-1 z-10 min-w-[52px]">Waktu</th>
                  {gridClasses.map(c => (
                    <th key={c.id} className="sticky top-0 bg-primary-900 text-white px-0.5 py-1 z-10 min-w-[30px] whitespace-nowrap">
                      {c.name.replace(/^(X|XI|XII)\s/, "")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => {
                  const rows = periodsByDay.get(day) ?? [];
                  return rows.map((row, ri) => (
                    <tr key={row.id} className="border-b border-gray-50">
                      {ri === 0 && (
                        <td rowSpan={rows.length} className="sticky left-0 bg-primary-50 text-primary-900 font-bold px-1 py-0.5 align-top border-r border-gray-100">
                          {DAY_LABEL[day].slice(0, 3)}
                        </td>
                      )}
                      <td className="px-1 py-0.5 text-gray-400 whitespace-nowrap border-r border-gray-100">{row.startTime}</td>
                      {row.isBreak ? (
                        <td colSpan={gridClasses.length} className="px-1 py-0.5 text-center text-[8px] font-semibold text-violet-700 bg-violet-50 truncate">
                          {row.label ?? "Istirahat"}
                        </td>
                      ) : (
                        gridClasses.map(c => {
                          const sched = scheduleIndex.get(`${c.id}|${day}|${row.startTime}`);
                          if (!sched) return <td key={c.id} className="px-0.5 py-0.5 text-center text-gray-300">·</td>;
                          const info = codeIndex.get(`${c.id}|${sched.subject}`);
                          const color = colorForTeacherCode(info?.teacherCode ?? "?");
                          return (
                            <td key={c.id} title={sched.subject} style={{ background: color.bg, color: color.text }} className="px-0 py-0.5 text-center font-bold">
                              <div className="flex divide-x divide-current/20 justify-center leading-tight">
                                <span className="px-0.5">{info?.teacherCode ?? "?"}</span>
                                <span className="px-0.5">{info?.subjectCode ?? "?"}</span>
                              </div>
                            </td>
                          );
                        })
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<CalendarDays size={22} />}
        title="Jadwal Non-Blok (Dapodik)"
        description={`${schedules.length} jam pelajaran — 1 minggu, tanpa kali 2, khusus upload Dapodik`}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <Link href="/dashboard/admin/schedules" className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
          <ArrowLeft size={16} /> Ke Jadwal Blok
        </Link>
        <Link href="/dashboard/admin/schedules/nonblok/print"
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
          <Printer size={16} /> Cetak Gabungan
        </Link>
        <Link href={selectedClass ? `/dashboard/admin/schedules/nonblok/print-class?classId=${selectedClass}` : "/dashboard/admin/schedules/nonblok/print-class"}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
          <Printer size={16} /> Cetak per Kelas
        </Link>
        <button onClick={() => { setShowGenerate(true); setGenerateReport(null); }}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
          <Wand2 size={16} /> Generate Otomatis
        </button>
        <button onClick={openNew} className="btn-gold flex items-center gap-2 text-sm sm:ml-auto">
          <Plus size={18} /> Tambah Jadwal
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
        {classes.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada kelas.</p>
        ) : (
          <div className="inline-block w-64">
            <Select
              value={selectedClass}
              onChange={v => setSelectedClass(v)}
              options={classes.map(c => ({ value: c.id, label: `${c.name} — ${c.major.name}` }))}
            />
          </div>
        )}
      </div>

      {renderScheduleGrid()}

      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DAYS.map(day => (
            <div key={day} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-primary-900 text-white text-sm font-bold">{DAY_LABEL[day]}</div>
              <div className="divide-y divide-gray-50">
                {byDay[day].length === 0 ? (
                  <p className="px-4 py-3 text-xs text-gray-400">Tidak ada jadwal</p>
                ) : (
                  byDay[day].map(s => (
                    <div key={s.id} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <p className="font-mono text-gray-400">{s.startTime}–{s.endTime}</p>
                        <p className="font-semibold text-gray-800">{s.subject}</p>
                        <p className="text-gray-500">{s.teacher?.user.name ?? "—"}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-primary-700 rounded hover:bg-primary-50"><Pencil size={13} /></button>
                        <button onClick={() => remove(s.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={13} /></button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      <Modal scrollBody
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? "Edit Jadwal Non-Blok" : "Tambah Jadwal Non-Blok"}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={saveForm} disabled={saving} className="btn-modal-save flex-1">
              {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {msg && <Alert variant="error">{msg}</Alert>}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kelas</label>
            <Select value={form.classId} onChange={v => setForm(f => ({ ...f, classId: v, subject: "" }))}
              options={classes.map(c => ({ value: c.id, label: c.name }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mata Pelajaran</label>
            <Select value={form.subject} onChange={v => setForm(f => ({ ...f, subject: v }))} options={subjectOptions} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Guru Pengampu</label>
            <Select value={form.teacherId} onChange={v => setForm(f => ({ ...f, teacherId: v }))}
              options={teachers.map(t => ({ value: t.id, label: t.user.name }))} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hari</label>
            <Select value={form.day} onChange={v => setForm(f => ({ ...f, day: v }))}
              options={DAYS.map(d => ({ value: d, label: DAY_LABEL[d] }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jam Mulai</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Jam Selesai</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Modal Generate */}
      <Modal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        title={<span className="flex items-center gap-2"><Wand2 size={18} /> Generate Jadwal Non-Blok</span>}
        footer={
          generateReport ? (
            <button onClick={() => setShowGenerate(false)} className="btn-modal-save flex-1">Tutup</button>
          ) : (
            <button onClick={() => setShowGenerate(false)} className="btn-modal-cancel flex-1">Batal</button>
          )
        }
      >
        {!generateReport ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Sistem akan mengisi jadwal <strong>1 minggu biasa</strong> (tanpa kali 2, tanpa bergantian Minggu 1/2) berdasarkan Penugasan Mengajar yang sudah diatur — khusus untuk keperluan upload Dapodik. Jadwal non-blok lama pada kelas yang di-generate akan dihapus dan digantikan. Jadwal blok (operasional harian) tidak akan tersentuh sama sekali.
            </p>
            <button
              disabled={generating || !selectedClass}
              onClick={() => runGenerate("class")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-primary-200 text-primary-700 font-semibold text-sm hover:bg-primary-50 transition disabled:opacity-60"
            >
              {generating && <Loader2 size={15} className="animate-spin" />}
              Generate untuk kelas ini saja{activeClass ? ` (${activeClass.name})` : ""}
            </button>
            <button
              disabled={generating}
              onClick={() => runGenerate("all")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-700 hover:bg-primary-800 text-white font-semibold text-sm transition disabled:opacity-60"
            >
              {generating && <Loader2 size={15} className="animate-spin" />}
              Generate untuk semua kelas
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <Alert variant="success">
              <span className="flex items-center gap-2"><CheckCircle2 size={15} /> {generateReport.created} jam pelajaran berhasil dijadwalkan di {generateReport.classesProcessed} kelas.</span>
            </Alert>
            {generateReport.unscheduled.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-amber-700 flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} /> Belum sepenuhnya terjadwal:
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {generateReport.unscheduled.map((u, i) => (
                    <div key={i} className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2">
                      <strong>{u.className}</strong> — {u.subjectName} ({u.teacherName}): kurang {u.missingHours} jam
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
