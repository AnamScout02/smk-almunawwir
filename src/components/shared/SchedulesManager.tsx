"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Calendar, CalendarDays, Loader2, Wand2, AlertTriangle, CheckCircle2, Printer, Lock } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import Alert from "@/components/admin/Alert";
import { weekLabel, weekTypesOverlap } from "@/lib/schedule-week";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface ClassItem { id: string; name: string; grade: number; major: { id: string; name: string } }
interface TeacherItem { id: string; subject: string; user: { name: string } }
interface SubjectItem { id: string; code: number; name: string; category: string; grade: number; majorId: string | null }
interface ScheduleItem {
  id: string; classId: string; teacherId: string | null; subject: string;
  day: string; startTime: string; endTime: string; room: string | null; generated?: boolean; weekType: string;
  class: { name: string; major: { name: string } };
  teacher: { user: { name: string } } | null;
}
interface PeriodItem { id: string; day: string; order: number; startTime: string; endTime: string; isBreak: boolean; label?: string | null }
interface PendingAssignment {
  subject: { name: string };
  teacher: { user: { name: string } };
  preferences: { day: string; startTime: string; hours: number; weekType: string }[];
}
interface GenerateReport {
  created: number;
  classesProcessed: number;
  unscheduled: { className: string; subjectName: string; teacherName: string; missingHours: number }[];
}
interface UnscheduledItem {
  className: string; subjectName: string; teacherName: string;
  expectedHours: number; actualHours: number; missingHours: number;
  suggestion: string | null;
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

const emptyForm = { classId: "", teacherId: "", subject: "", day: "SENIN", startTime: "07:00", endTime: "08:30", room: "", weekType: "SEMUA" };

interface SchedulesManagerProps {
  basePath?: string;
  schoolPeriodsHref?: string;
  classesHref?: string;
  showPrintLinks?: boolean;
}

export default function SchedulesManager({
  basePath = "/dashboard/admin/schedules",
  schoolPeriodsHref = "/dashboard/admin/school-periods",
  classesHref = "/dashboard/admin/classes",
  showPrintLinks = true,
}: SchedulesManagerProps) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  // Dipakai HANYA sbg default minggu saat buka form "Tambah Jadwal" — tampilan utama sekarang
  // menampilkan Minggu 1 & 2 sekaligus terpisah, tidak perlu toggle pilih minggu dulu.
  const [defaultWeek, setDefaultWeek] = useState("SEMUA");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [deletingGenerated, setDeletingGenerated] = useState(false);
  const [generateReport, setGenerateReport] = useState<GenerateReport | null>(null);
  const [unscheduledList, setUnscheduledList] = useState<UnscheduledItem[]>([]);
  const [showUnscheduled, setShowUnscheduled] = useState(true);
  const [scheduleLocked, setScheduleLocked] = useState(false);
  const [togglingLock, setTogglingLock] = useState(false);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [pendingAssignments, setPendingAssignments] = useState<PendingAssignment[]>([]);

  const loadUnscheduled = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/schedules/unscheduled");
      setUnscheduledList(await res.json());
    } catch {
      setUnscheduledList([]);
    }
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
    }).catch(() => {});
    loadUnscheduled();
    fetch("/api/admin/schedules/lock").then(r => r.json()).then(d => setScheduleLocked(!!d.locked)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggleLock() {
    const next = !scheduleLocked;
    if (next && !(await confirmDialog("Kunci jadwal sekarang? Generate Otomatis dan Hapus Hasil Generate akan diblokir sampai dibuka lagi."))) return;
    if (!next && !(await confirmDialog("Buka kunci jadwal? Generate Otomatis dan Hapus Hasil Generate akan bisa dipakai lagi."))) return;
    setTogglingLock(true);
    try {
      const res = await fetch("/api/admin/schedules/lock", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ locked: next }),
      });
      const data = await res.json();
      setScheduleLocked(!!data.locked);
    } catch {
      toast.error("Gagal mengubah status kunci — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setTogglingLock(false);
    }
  }

  // Ambil SEMUA minggu sekaligus (bukan cuma satu weekType) — Minggu 1 & 2 ditampilkan
  // terpisah berdampingan per hari, tidak perlu toggle pilih minggu dulu.
  const loadSchedules = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([
        fetch(`/api/admin/schedules?classId=${classId}`),
        fetch(`/api/admin/teaching-assignments?classId=${classId}`),
      ]);
      setSchedules(await sRes.json());
      const a = await aRes.json();
      setPendingAssignments(Array.isArray(a) ? a : []);
    } catch {
      setSchedules([]);
      setPendingAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function periodsForDay(day: string) {
    return periods.filter(p => p.day === day && !p.isBreak).sort((a, b) => a.order - b.order);
  }

  function allPeriodsForDay(day: string) {
    return periods.filter(p => p.day === day).sort((a, b) => a.order - b.order);
  }

  // Preferensi hari/jam yang belum tercermin persis di jadwal yang sudah ter-generate (untuk
  // minggu yang sedang dilihat) — supaya halaman ini juga real-time menunjukkan request yang
  // baru diisi di Penugasan Mengajar, sebelum sempat di-generate.
  // Satu preferensi bisa mencakup beberapa jam ke- berurutan — pecah jadi SATU ENTRY PER JAM
  // KE- (bukan cuma 1 entry di jam pertamanya) supaya tiap baris di kartu hari ini konsisten
  // granularitasnya dengan jadwal yang sudah tergenerate (yang juga 1 baris per jam ke-).
  function pendingForDay(day: string, weekType: string) {
    const dayPeriods = periodsForDay(day);
    const weekSchedules = schedules.filter(s => weekTypesOverlap(s.weekType, weekType));
    const result: { startTime: string; endTime: string; subjectName: string; teacherName: string; conflictWith: string | null }[] = [];
    for (const a of pendingAssignments) {
      for (const p of a.preferences) {
        if (p.day !== day) continue;
        if (!weekTypesOverlap(p.weekType, weekType)) continue;
        const startIdx = dayPeriods.findIndex(x => x.startTime === p.startTime);
        if (startIdx === -1) continue;
        for (let i = startIdx; i < Math.min(startIdx + p.hours, dayPeriods.length); i++) {
          const period = dayPeriods[i];
          const already = weekSchedules.some(s => s.day === day && s.startTime === period.startTime && s.subject === a.subject.name);
          if (already) continue;
          const clashing = weekSchedules.find(s => s.day === day && s.startTime === period.startTime);
          result.push({
            startTime: period.startTime, endTime: period.endTime,
            subjectName: a.subject.name, teacherName: a.teacher.user.name,
            conflictWith: clashing ? clashing.subject : null,
          });
        }
      }
    }
    return result.sort((x, y) => x.startTime.localeCompare(y.startTime));
  }

  // Jadwal yang sudah tergenerate TAPI berasal dari Preferensi Hari/Jam yang sengaja diminta —
  // dikunci (tidak ada tombol edit/hapus) supaya tidak kesenggol tidak sengaja. Kalau memang mau
  // diubah, ubah/hapus dulu request-nya di Penugasan Mengajar lalu generate ulang.
  function isFromRequest(s: ScheduleItem): boolean {
    const dayPeriods = periodsForDay(s.day);
    const idx = dayPeriods.findIndex(x => x.startTime === s.startTime);
    if (idx === -1) return false;
    for (const a of pendingAssignments) {
      if (a.subject.name !== s.subject) continue;
      for (const p of a.preferences) {
        if (p.day !== s.day) continue;
        if (!weekTypesOverlap(p.weekType, s.weekType)) continue;
        const startIdx = dayPeriods.findIndex(x => x.startTime === p.startTime);
        if (startIdx === -1) continue;
        if (idx >= startIdx && idx < startIdx + p.hours) return true;
      }
    }
    return false;
  }

  const activeClass = classes.find(c => c.id === selectedClass);
  const isRotating = activeClass ? (activeClass.grade === 10 || activeClass.grade === 11) : false;

  useEffect(() => {
    setDefaultWeek(isRotating ? "A" : "SEMUA");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass]);

  useEffect(() => {
    if (selectedClass) loadSchedules(selectedClass);
  }, [selectedClass, loadSchedules]);

  async function runGenerate(scope: "class" | "all") {
    setGenerating(true);
    setGenerateReport(null);
    try {
      const body = scope === "class" ? { classIds: [selectedClass] } : {};
      const res = await fetch("/api/admin/schedules/generate", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal generate jadwal"); return; }
      setGenerateReport(data);
      if (selectedClass) loadSchedules(selectedClass);
      loadUnscheduled();
    } catch {
      toast.error("Gagal generate jadwal — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setGenerating(false);
    }
  }

  async function deleteGenerated(scope: "class" | "all") {
    const label = scope === "class" ? `kelas ${activeClass?.name ?? "ini"}` : "SEMUA kelas";
    if (!(await confirmDialog(`Hapus semua hasil Generate Otomatis untuk ${label}? Jadwal yang ditambah/diedit manual tidak akan ikut terhapus. Preferensi Hari/Jam yang sudah diisi tetap aman dan bisa digenerate ulang.`))) return;
    setDeletingGenerated(true);
    try {
      const qs = scope === "class" && selectedClass ? `?classId=${selectedClass}` : "";
      const res = await fetch(`/api/admin/schedules${qs}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Gagal menghapus"); return; }
      toast.success(`${data.deleted} jam pelajaran hasil generate berhasil dihapus.`);
      if (selectedClass) loadSchedules(selectedClass);
      loadUnscheduled();
    } catch {
      toast.error("Gagal menghapus — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setDeletingGenerated(false);
    }
  }

  function openNew(weekType?: string) {
    setForm({ ...emptyForm, classId: selectedClass, weekType: weekType ?? defaultWeek });
    setEditing(null); setShowForm(true); setMsg("");
  }
  function openEdit(s: ScheduleItem) {
    setForm({ classId: s.classId, teacherId: s.teacherId ?? "", subject: s.subject, day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room ?? "", weekType: s.weekType });
    setEditing(s); setShowForm(true); setMsg("");
  }

  async function save() {
    if (!form.classId || !form.subject || !form.day || !form.startTime || !form.endTime) { setMsg("Data tidak lengkap"); return; }
    setSaving(true);
    try {
      const method = editing ? "PUT" : "POST";
      const url = editing ? `/api/admin/schedules/${editing.id}` : "/api/admin/schedules";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (res.ok) { setShowForm(false); loadSchedules(selectedClass); loadUnscheduled(); }
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
    loadUnscheduled();
  }

  function byDayForWeek(weekType: string): Record<string, ScheduleItem[]> {
    const weekSchedules = schedules.filter(s => weekTypesOverlap(s.weekType, weekType));
    return DAYS.reduce<Record<string, ScheduleItem[]>>((acc, d) => {
      acc[d] = weekSchedules.filter(s => s.day === d).sort((a, b) => a.startTime.localeCompare(b.startTime));
      return acc;
    }, {} as Record<string, ScheduleItem[]>);
  }

  function renderWeekTimetable(weekType: string, label?: string) {
    const byDay = byDayForWeek(weekType);
    return (
      <div>
        {label && (
          <h2 className="font-heading text-sm font-bold text-primary-900 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-primary-700 text-white flex items-center justify-center text-[11px]">{weekType === "A" ? "1" : "2"}</span>
            {label}
            <button onClick={() => openNew(weekType)} className="ml-1 text-[11px] font-semibold text-primary-700 hover:underline">+ Tambah</button>
          </h2>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {DAYS.map(day => {
            const pending = pendingForDay(day, weekType);
            const rows = allPeriodsForDay(day);
            return (
            <div key={day} className={`rounded-2xl border-2 ${DAY_COLOR[day]} overflow-hidden`}>
              <div className={`px-4 py-3 flex items-center justify-between`}>
                <h3 className="font-heading font-bold text-sm">{DAY_LABEL[day]}</h3>
                <span className="text-xs opacity-70">{byDay[day].length} jam{pending.length > 0 ? ` · ${pending.length} request` : ""}</span>
              </div>
              <div className="bg-white divide-y divide-gray-50">
                {rows.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400 text-center">
                    Kerangka jam pelajaran hari ini belum diatur — buka menu{" "}
                    <a href={schoolPeriodsHref} className="underline font-semibold">Kerangka Jam Pelajaran</a>.
                  </p>
                ) : rows.map(period => {
                  if (period.isBreak) {
                    return (
                      <div key={period.id} className="px-4 py-2 text-center text-[11px] font-semibold text-violet-700 bg-violet-50/70">
                        {period.startTime}–{period.endTime} · {period.label ?? "Istirahat"}
                      </div>
                    );
                  }
                  // PERBAIKAN 2026-08-11 (temuan user, verifikasi ulang jadwal thd PDF resmi): dulu
                  // cuma exact-match startTime — baris yg block-merge (mencakup beberapa periode
                  // sekaligus, mis. "07:15–09:15" utk 4 periode 30 menit) TIDAK KETEMU di periode
                  // 2/3/4-nya (cuma tampil di periode pertama), kelihatan seperti "Kosong" padahal
                  // sebenarnya terisi. Sekarang dicari baris yg RENTANG [startTime,endTime)-nya
                  // mencakup periode ini — kalau ini BUKAN periode pertama blok itu, jangan
                  // ditampilkan lagi (sudah muncul di baris periode pertamanya, dgn badge N JP).
                  const s = byDay[day].find(x => x.startTime <= period.startTime && period.startTime < x.endTime);
                  const p = pending.find(x => x.startTime === period.startTime);
                  if (s && s.startTime !== period.startTime) {
                    return <div key={period.id} className="hidden" />; // periode lanjutan blok — sudah tampil di atas
                  }
                  if (s) {
                    const locked = s.generated && isFromRequest(s);
                    const spanPeriods = rows.filter(r => !r.isBreak && r.startTime >= s.startTime && r.startTime < s.endTime).length;
                    return (
                      <div key={period.id} title={locked ? "Terkunci — berasal dari Preferensi Hari/Jam. Ubah/hapus request-nya di Penugasan Mengajar lalu generate ulang kalau mau diganti." : undefined}
                        className={`px-4 py-3 flex items-start justify-between group hover:bg-gray-50 ${locked ? "bg-primary-50/30" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-bold text-primary-700 font-mono">Ke-{period.order}: {s.startTime}–{s.endTime}</span>
                            {spanPeriods > 1 && <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{spanPeriods} JP</span>}
                            {s.room && <span className="text-xs text-gray-400">{s.room}</span>}
                            {locked ? (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-primary-700 bg-primary-100 px-1.5 py-0.5 rounded-full">
                                <Lock size={9} /> REQUEST
                              </span>
                            ) : s.generated && (
                              <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">AUTO</span>
                            )}
                          </div>
                          <p className="font-semibold text-sm text-gray-800 truncate">{s.subject}</p>
                          {s.teacher && <p className="text-xs text-gray-400 truncate">{s.teacher.user.name}</p>}
                        </div>
                        {!locked && (
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition shrink-0 ml-2">
                            <button onClick={() => openEdit(s)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Pencil size={13} /></button>
                            <button onClick={() => remove(s.id)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"><Trash2 size={13} /></button>
                          </div>
                        )}
                      </div>
                    );
                  }
                  if (p) {
                    return (
                      <div key={period.id} className={`px-4 py-3 border-l-4 ${p.conflictWith ? "border-red-400 bg-red-50/60" : "border-dashed border-primary-300 bg-primary-50/40"}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-bold text-primary-700 font-mono">Ke-{period.order}: {p.startTime}–{p.endTime}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${p.conflictWith ? "text-red-700 bg-red-100" : "text-primary-700 bg-primary-100"}`}>
                            {p.conflictWith ? "BENTROK" : "REQUEST"}
                          </span>
                        </div>
                        <p className="font-semibold text-sm text-gray-800 truncate">{p.subjectName}</p>
                        <p className="text-xs text-gray-400 truncate">
                          {p.teacherName}
                          {p.conflictWith && <> — kepakai &quot;{p.conflictWith}&quot;, belum digenerate</>}
                          {!p.conflictWith && <> — belum digenerate</>}
                        </p>
                      </div>
                    );
                  }
                  return (
                    <div key={period.id} className="px-4 py-2 flex items-center gap-2 text-gray-300">
                      <span className="text-xs font-mono">Ke-{period.order}: {period.startTime}–{period.endTime}</span>
                      <span className="text-xs italic">Kosong</span>
                    </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    );
  }

  const formClass = classes.find(c => c.id === form.classId);
  const formClassRotating = formClass ? (formClass.grade === 10 || formClass.grade === 11) : false;
  const subjectOptions = formClass
    ? subjects
        .filter(s => s.grade === formClass.grade)
        .filter(s => !s.majorId || s.majorId === formClass.major.id)
        .map(s => ({ value: s.name, label: `${s.code} — ${s.name}` }))
    : [];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Calendar size={22} />}
        title="Jadwal Pelajaran"
        description={`${schedules.length} jam pelajaran terjadwal`}
      />

      {/* Tombol-tombol di baris TERPISAH di bawah header (bukan di actions PageHeader) — actions
          berbagi baris dengan judul, jadi kalau diisi banyak tombol judul & deskripsinya kepepet
          bahkan bisa tertimpa (persis laporan user: teks "jam pelajaran terjadwal" ketiban tombol). */}
      <div className="flex flex-wrap gap-2 mb-5">
        {showPrintLinks && (
          <>
            <Link href="/dashboard/admin/schedules/nonblok"
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
              <CalendarDays size={16} /> Jadwal Non-Blok
            </Link>
            <Link href="/dashboard/admin/schedules/print?week=A"
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
              <Printer size={16} /> Cetak Tabel Gabungan
            </Link>
            <Link href={selectedClass ? `/dashboard/admin/schedules/print-class?classId=${selectedClass}&week=${defaultWeek}` : "/dashboard/admin/schedules/print-class"}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition">
              <Printer size={16} /> Cetak per Kelas
            </Link>
          </>
        )}
        <button
          disabled={scheduleLocked}
          onClick={() => { setShowGenerate(true); setGenerateReport(null); }}
          title={scheduleLocked ? "Jadwal dikunci — buka kunci dulu untuk generate" : ""}
          className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100 transition disabled:opacity-40 disabled:cursor-not-allowed">
          <Wand2 size={16} /> Generate Otomatis
        </button>
        <button onClick={toggleLock} disabled={togglingLock}
          title={scheduleLocked ? "Buka kunci jadwal" : "Kunci jadwal supaya tidak bisa digenerate ulang"}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border transition disabled:opacity-60 ${
            scheduleLocked ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" : "border-primary-100 bg-primary-50 text-primary-700 hover:bg-primary-100"
          }`}>
          {togglingLock ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
          {scheduleLocked ? "Terkunci" : "Kunci Jadwal"}
        </button>
        <button onClick={() => openNew()} className="btn-gold flex items-center gap-2 text-sm sm:ml-auto">
          <Plus size={18} /> Tambah Jadwal
        </button>
      </div>

      {scheduleLocked && (
        <Alert variant="warning">
          <span className="flex items-center gap-2">
            <Lock size={15} /> Jadwal sedang <strong>terkunci</strong> — Generate Otomatis dan Hapus Hasil Generate tidak bisa dipakai sampai kuncinya dibuka. Edit/tambah/hapus manual per baris tetap bisa seperti biasa.
          </span>
        </Alert>
      )}

      {/* Class Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
        {classes.length === 0 ? (
          <p className="text-sm text-gray-400">
            Belum ada kelas. Tambahkan kelas dulu di menu{" "}
            <a href={classesHref} className="text-primary-700 font-semibold hover:underline">Kelas</a>.
          </p>
        ) : (
          <>
            <div className="inline-block w-64">
              <Select
                value={selectedClass}
                onChange={v => setSelectedClass(v)}
                options={classes.map(c => ({ value: c.id, label: `${c.name} — ${c.major.name}` }))}
              />
            </div>
            {activeClass && (
              <span className="ml-3 text-xs text-gray-500">
                Kelas {activeClass.grade} · {activeClass.major.name}
                {isRotating && " · Minggu 1 & 2 ditampilkan terpisah di bawah"}
              </span>
            )}
          </>
        )}
      </div>

      {/* Timetable */}
      {loading ? (
        <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
      ) : isRotating ? (
        <div className="space-y-8">
          {renderWeekTimetable("A", "Minggu 1")}
          {renderWeekTimetable("B", "Minggu 2")}
        </div>
      ) : (
        renderWeekTimetable("SEMUA")
      )}

      {/* Daftar belum terjadwal — dihitung langsung dari data saat ini, selalu akurat */}
      {unscheduledList.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <button onClick={() => setShowUnscheduled(v => !v)}
            className="w-full px-5 py-3.5 flex items-center justify-between gap-3 bg-amber-500 text-white">
            <span className="flex items-center gap-2 font-heading font-bold text-sm">
              <AlertTriangle size={15} /> Belum Sepenuhnya Terjadwal ({unscheduledList.length})
            </span>
            <span className="text-xs font-semibold">{showUnscheduled ? "Sembunyikan ▲" : "Tampilkan ▼"}</span>
          </button>
          {showUnscheduled && (
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {unscheduledList.map((u, i) => (
                <div key={i} className="px-5 py-2.5 text-xs text-gray-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>
                      <strong className="text-gray-800">{u.className}</strong> — {u.subjectName} ({u.teacherName})
                    </span>
                    <span className="text-amber-700 font-semibold shrink-0">
                      {u.actualHours}/{u.expectedHours} jam (kurang {u.missingHours})
                    </span>
                  </div>
                  {u.suggestion && (
                    <p className="mt-1 text-[11px] text-primary-700 bg-primary-50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                      <strong>Saran:</strong> {u.suggestion}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Form */}
      <Modal scrollBody
        open={showForm}
        onClose={() => setShowForm(false)}
        title={<span className="flex items-center gap-2"><Calendar size={18} /> {editing ? "Edit Jadwal" : "Tambah Jadwal"}</span>}
        footer={
          <>
            <button onClick={() => setShowForm(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button onClick={save} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label-field">Kelas *</label>
            <Select
              value={form.classId}
              onChange={v => {
                const c = classes.find(x => x.id === v);
                const rotating = c ? (c.grade === 10 || c.grade === 11) : false;
                setForm(f => ({ ...f, classId: v, weekType: rotating ? (f.weekType === "SEMUA" ? "A" : f.weekType) : "SEMUA" }));
              }}
              options={classes.map(c => ({ value: c.id, label: `${c.name} — ${c.major.name}` }))}
              placeholder="Pilih kelas..."
            />
          </div>
          {formClassRotating && (
            <div>
              <label className="label-field">Minggu *</label>
              <Select
                value={form.weekType}
                onChange={v => setForm(f => ({ ...f, weekType: v }))}
                options={(["A", "B"] as const).map(wt => ({ value: wt, label: weekLabel(formClass!.grade, wt) }))}
              />
            </div>
          )}
          <div>
            <label className="label-field">Mata Pelajaran *</label>
            {form.classId ? (
              <Select
                value={form.subject}
                onChange={v => setForm(f => ({ ...f, subject: v }))}
                options={subjectOptions}
                placeholder="Pilih mata pelajaran..."
              />
            ) : (
              <p className="text-xs text-gray-400 italic py-2">Pilih kelas terlebih dahulu untuk melihat daftar mapel</p>
            )}
          </div>
          <div>
            <label className="label-field">Guru (opsional)</label>
            <Select
              value={form.teacherId}
              onChange={v => setForm(f => ({ ...f, teacherId: v }))}
              options={teachers.map(t => ({ value: t.id, label: `${t.user.name} (${t.subject})` }))}
              placeholder="-- Pilih guru --"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Hari *</label>
              <Select
                value={form.day}
                onChange={v => setForm(f => ({ ...f, day: v }))}
                options={DAYS.map(d => ({ value: d, label: DAY_LABEL[d] }))}
              />
            </div>
            <div>
              <label className="label-field">Ruang</label>
              <input value={form.room} onChange={e => setForm(f => ({ ...f, room: e.target.value }))}
                className="input-field"
                placeholder="Lab-1, R.12, dll." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Jam Mulai *</label>
              <input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
                className="input-field" />
            </div>
            <div>
              <label className="label-field">Jam Selesai *</label>
              <input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
                className="input-field" />
            </div>
          </div>
          {msg && <p className="error-msg">{msg}</p>}
        </div>
      </Modal>

      {/* Modal Generate Otomatis */}
      <Modal
        open={showGenerate}
        onClose={() => setShowGenerate(false)}
        title={<span className="flex items-center gap-2"><Wand2 size={18} /> Generate Jadwal Otomatis</span>}
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
              Sistem akan mengisi jadwal otomatis berdasarkan <strong>Penugasan Mengajar</strong> dan <strong>Kerangka Jam Pelajaran</strong> yang sudah diatur. Jadwal lama pada kelas yang di-generate akan <strong>dihapus dan digantikan</strong>. Satu guru dijamin tidak akan bentrok di jam yang sama di kelas manapun.
            </p>
            <p className="text-sm text-gray-500">
              Khusus kelas <strong>X</strong> dan <strong>XI</strong>, jadwal dibuat bergantian 2 minggu (Minggu 1/2) dan saling terbalik: saat kelas X belajar mapel produktif jam ganda, kelas XI belajar mapel umum &amp; diniyah jam ganda, minggu berikutnya kebalikannya. Kelas XII tetap 1 jadwal seperti biasa.
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
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary-700 hover:bg-primary-900 text-white font-semibold text-sm transition disabled:opacity-60"
            >
              {generating && <Loader2 size={15} className="animate-spin" />}
              Generate untuk semua kelas
            </button>

            <div className="pt-2 border-t border-gray-100 space-y-2">
              <p className="text-xs text-gray-400">Ingin bersihkan hasil generate lalu susun ulang manual? Preferensi Hari/Jam tidak ikut terhapus.</p>
              <button
                disabled={deletingGenerated || !selectedClass || scheduleLocked}
                onClick={() => deleteGenerated("class")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition disabled:opacity-60"
              >
                {deletingGenerated ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Hapus hasil generate kelas ini saja{activeClass ? ` (${activeClass.name})` : ""}
              </button>
              <button
                disabled={deletingGenerated || scheduleLocked}
                onClick={() => deleteGenerated("all")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-300 text-red-700 font-semibold text-sm hover:bg-red-50 transition disabled:opacity-60"
              >
                {deletingGenerated ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Hapus hasil generate SEMUA kelas
              </button>
            </div>
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
                    <div key={i} className="text-xs bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-amber-800">
                      {u.subjectName === "(semua mapel)" ? (
                        <>Kelas <strong>{u.className}</strong> belum ada Penugasan Mengajar sama sekali.</>
                      ) : (
                        <>Kelas <strong>{u.className}</strong> — {u.subjectName} ({u.teacherName}): kurang {u.missingHours} jam belum dapat slot.</>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">Tambah slot di Kerangka Jam Pelajaran, atau atur ulang Penugasan Mengajar, lalu generate ulang.</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
