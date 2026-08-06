"use client";
import { Fragment, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { UserCog, Loader2, X, CheckCircle2, AlertTriangle, Printer, Table2, ChevronDown, ChevronUp, Download } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Alert from "@/components/admin/Alert";
import { weekLabel, weekTypesOverlap } from "@/lib/schedule-week";
import { colorForTeacherCode } from "@/lib/teacher-colors";
import { useToast } from "@/components/shared/ToastProvider";

interface ClassItem { id: string; name: string; grade: number; major: { id: string; name: string; code: string } }
interface TeacherItem { id: string; subject: string; user: { name: string } }
interface SubjectItem { id: string; code: number; name: string; category: string; grade: number; majorId: string | null; hoursPerWeek: number; maxSharedTeacher: number }
interface PreferenceBlock { id: string; day: string; startTime: string; hours: number; weekType: string }
interface AssignmentItem {
  id: string; classId: string; subjectId: string; teacherId: string;
  subject: SubjectItem;
  teacher: { user: { name: string }; shortCode: string | null };
  preferences: PreferenceBlock[];
}
interface PeriodItem { id: string; day: string; order: number; startTime: string; endTime: string; isBreak: boolean; label?: string | null }
interface DraftPreference { day: string; startTime: string; endTime: string; weekType: string }
interface ScheduleRow { classId: string; teacherId: string | null; subject: string; day: string; startTime: string; weekType: string }
interface TeacherPrefRow { teacherId: string; assignmentId: string; subjectName: string; day: string; startTime: string; hours: number; weekType: string }

const TARGET_JP: Record<number, number> = { 10: 56, 11: 56, 12: 48 };
const DAYS = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
const DAY_LABEL: Record<string, string> = { SENIN: "Senin", SELASA: "Selasa", RABU: "Rabu", KAMIS: "Kamis", JUMAT: "Jumat", SABTU: "Sabtu" };

export default function TeachingAssignmentsManager({ basePath = "/dashboard/admin/teaching-assignments", subjectsHref = "/dashboard/admin/subjects" }: { basePath?: string; subjectsHref?: string }) {
  const toast = useToast();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
  const [teacherSchedules, setTeacherSchedules] = useState<ScheduleRow[]>([]);
  const [allTeacherPrefs, setAllTeacherPrefs] = useState<TeacherPrefRow[]>([]);
  const [allAssignments, setAllAssignments] = useState<AssignmentItem[]>([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, DraftPreference>>({});
  const [showGrid, setShowGrid] = useState(true);
  const [gridWeek, setGridWeek] = useState<"A" | "B">("A");
  const [exportingGrid, setExportingGrid] = useState(false);

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
  }, []);

  const load = useCallback(async (classId: string) => {
    if (!classId) return;
    setLoading(true);
    try {
      const [aRes, sRes, allARes] = await Promise.all([
        fetch(`/api/admin/teaching-assignments?classId=${classId}`),
        fetch(`/api/admin/schedules`),
        fetch(`/api/admin/teaching-assignments`),
      ]);
      setAssignments(await aRes.json());
      const schedules = await sRes.json();
      setTeacherSchedules(Array.isArray(schedules) ? schedules.map((s: { classId: string; teacherId: string | null; subject: string; day: string; startTime: string; weekType: string }) => ({
        classId: s.classId, teacherId: s.teacherId, subject: s.subject, day: s.day, startTime: s.startTime, weekType: s.weekType,
      })) : []);
      const allAssignmentsData: AssignmentItem[] = await allARes.json();
      const prefRows: TeacherPrefRow[] = [];
      if (Array.isArray(allAssignmentsData)) {
        for (const a of allAssignmentsData) {
          for (const p of a.preferences) {
            prefRows.push({ teacherId: a.teacherId, assignmentId: a.id, subjectName: a.subject.name, day: p.day, startTime: p.startTime, hours: p.hours, weekType: p.weekType });
          }
        }
      }
      setAllTeacherPrefs(prefRows);
      setAllAssignments(Array.isArray(allAssignmentsData) ? allAssignmentsData : []);
    } catch {
      setAssignments([]);
      setTeacherSchedules([]);
      setAllTeacherPrefs([]);
      setAllAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedClass) load(selectedClass); }, [selectedClass, load]);

  const activeClass = classes.find(c => c.id === selectedClass);
  const applicableSubjects = activeClass
    ? subjects
        .filter(s => s.grade === activeClass.grade)
        .filter(s => !s.majorId || s.majorId === activeClass.major.id)
        .sort((a, b) => a.name.localeCompare(b.name))
    : [];

  async function setTeacherFor(subjectId: string, teacherId: string) {
    const existing = assignments.find(a => a.subjectId === subjectId);
    setSavingId(subjectId);
    try {
      if (!teacherId) {
        if (existing) await fetch(`/api/admin/teaching-assignments/${existing.id}`, { method: "DELETE" });
      } else if (existing) {
        await fetch(`/api/admin/teaching-assignments/${existing.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacherId }),
        });
      } else {
        await fetch("/api/admin/teaching-assignments", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ classId: selectedClass, subjectId, teacherId }),
        });
      }
      await load(selectedClass);
    } finally {
      setSavingId(null);
    }
  }

  async function addPreferenceBlock(assignmentId: string, day: string, startTime: string, hours: number, weekType: string) {
    setSavingId(assignmentId);
    try {
      await fetch(`/api/admin/teaching-assignments/${assignmentId}/preferences`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, startTime, hours, weekType }),
      });
      await load(selectedClass);
    } finally {
      setSavingId(null);
    }
  }

  async function removePreferenceBlock(assignmentId: string, prefId: string) {
    setSavingId(assignmentId);
    try {
      await fetch(`/api/admin/teaching-assignments/${assignmentId}/preferences/${prefId}`, { method: "DELETE" });
      await load(selectedClass);
    } finally {
      setSavingId(null);
    }
  }

  function periodsForDay(day: string) {
    return periods.filter(p => p.day === day && !p.isBreak).sort((a, b) => a.order - b.order);
  }

  function allPeriodsForDay(day: string) {
    return periods.filter(p => p.day === day).sort((a, b) => a.order - b.order);
  }

  // Jam yang sudah "dipakai" mapel LAIN di kelas yang sama & hari yang sama (dari semua blok
  // preferensi yang sudah diisi) — supaya tidak bisa pilih jam yang bakal tabrakan sendiri
  // dalam 1 kelas.
  function occupiedStartTimes(day: string, excludeSubjectId: string, weekType: string): Set<string> {
    const dayPeriods = periodsForDay(day);
    const occupied = new Set<string>();
    for (const a of assignments) {
      if (a.subjectId === excludeSubjectId) continue;
      for (const pref of a.preferences) {
        if (pref.day !== day) continue;
        if (!weekTypesOverlap(pref.weekType, weekType)) continue;
        const startIdx = dayPeriods.findIndex(p => p.startTime === pref.startTime);
        if (startIdx === -1) continue;
        for (let i = startIdx; i < Math.min(startIdx + pref.hours, dayPeriods.length); i++) {
          occupied.add(dayPeriods[i].startTime);
        }
      }
    }
    return occupied;
  }

  // Jam yang sudah dipakai GURU ini mengajar kelas rotasi (X/XI) LAIN di minggu yang sama —
  // supaya tidak bisa pilih jam yang sebenarnya mustahil dipenuhi. Kelas XII ("SEMUA") SENGAJA
  // TIDAK dihitung bentrok di sini kalau kelas yang sedang diedit adalah kelas rotasi (X/XI) —
  // kelas XII sifatnya formalitas dan mengalah ke X/XI saat generate, jadi tidak boleh membatasi
  // pilihan jam mereka. Untuk kelas XII sendiri, bentrok dengan X/XI tetap dihitung (kelas XII
  // yang harus menyesuaikan). Jadwal hasil generate mapel INI SENDIRI di kelas ini dikecualikan
  // (bukan bentrok, itu cuma hasil generate sebelumnya untuk mapel yang sedang diedit).
  function teacherBusyStartTimes(day: string, teacherId: string, weekType: string, excludeClassId: string, excludeSubjectName: string, isRotatingClass: boolean, excludeAssignmentId: string, maxShared: number): Set<string> {
    const dayPeriods = periodsForDay(day);
    // Kumpulkan dulu SEMUA mapel guru ini per jam mulai — bukan langsung ditandai bentrok, karena
    // mapel dengan "maks kelas berbeda" (mis. Penjasorkes = 2) sengaja BOLEH dipegang guru yang
    // sama di beberapa kelas SEKALIGUS di jam yang sama (kelas gabungan), selama masih di bawah
    // batasnya dan mapelnya SAMA PERSIS — bentrok mapel BEDA tetap selalu diblokir.
    const subjectsPerSlot = new Map<string, string[]>();
    function addSlot(startTime: string, subject: string) {
      if (!subjectsPerSlot.has(startTime)) subjectsPerSlot.set(startTime, []);
      subjectsPerSlot.get(startTime)!.push(subject);
    }
    for (const sc of teacherSchedules) {
      if (sc.teacherId !== teacherId || sc.day !== day) continue;
      if (sc.classId === excludeClassId && sc.subject === excludeSubjectName) continue;
      if (isRotatingClass && sc.weekType === "SEMUA") continue;
      if (!weekTypesOverlap(sc.weekType, weekType)) continue;
      addSlot(sc.startTime, sc.subject);
    }
    // Request guru yang sama di KELAS LAIN yang belum sempat digenerate juga dihitung —
    // supaya tidak baru ketahuan gagal setelah Generate Otomatis dijalankan.
    for (const p of allTeacherPrefs) {
      if (p.teacherId !== teacherId || p.day !== day) continue;
      if (p.assignmentId === excludeAssignmentId) continue;
      if (isRotatingClass && p.weekType === "SEMUA") continue;
      if (!weekTypesOverlap(p.weekType, weekType)) continue;
      const startIdx = dayPeriods.findIndex(pd => pd.startTime === p.startTime);
      if (startIdx === -1) continue;
      for (let i = startIdx; i < Math.min(startIdx + p.hours, dayPeriods.length); i++) {
        addSlot(dayPeriods[i].startTime, p.subjectName);
      }
    }
    const occupied = new Set<string>();
    for (const [startTime, subjectsHere] of subjectsPerSlot) {
      const otherSubjectExists = subjectsHere.some(sub => sub !== excludeSubjectName);
      const sameSubjectCount = subjectsHere.filter(sub => sub === excludeSubjectName).length;
      if (otherSubjectExists || sameSubjectCount >= maxShared) occupied.add(startTime);
    }
    return occupied;
  }

  const totalHours = applicableSubjects.reduce((sum, s) => sum + s.hoursPerWeek, 0);
  const assignedHours = applicableSubjects
    .filter(s => assignments.some(a => a.subjectId === s.id))
    .reduce((sum, s) => sum + s.hoursPerWeek, 0);
  const targetHours = activeClass ? TARGET_JP[activeClass.grade] : undefined;

  function classTotalHours(c: ClassItem): number {
    return subjects
      .filter(s => s.grade === c.grade)
      .filter(s => !s.majorId || s.majorId === c.major.id)
      .reduce((sum, s) => sum + s.hoursPerWeek, 0);
  }

  // Tabel referensi jadwal penuh semua kelas X/XI (seperti tabel jadwal cetak sekolah), yang
  // hidup — langsung mencerminkan data terbaru (jadwal hasil generate + request yang belum
  // sempat digenerate) tiap kali ada perubahan, tanpa perlu generate ulang dulu. Sel merah =
  // dua hal berebut jam yang sama (baru ketahuan di sini, bukan setelah generate).
  // Ekspor tabel referensi jadwal ke file Excel (.xlsx) asli — dibuat server-side (bukan CSV)
  // supaya warna & kode per sel bisa persis sama seperti tabel live (CSV tidak bisa bawa warna).
  async function exportGridExcel() {
    setExportingGrid(true);
    try {
      const res = await fetch("/api/admin/export/schedule-grid");
      if (!res.ok) { toast.error("Gagal mengekspor jadwal"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jadwal-referensi-${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengekspor jadwal — periksa koneksi internet Anda dan coba lagi.");
    } finally {
      setExportingGrid(false);
    }
  }

  function renderScheduleGrid() {
    // Kelas X/XI bergantian minggu (weekType A/B), kelas XII tetap tiap minggu (weekType
    // SEMUA) — semuanya ditampilkan bareng, XII otomatis muncul sama persis di kedua tab
    // Minggu 1/2 karena SEMUA overlap dengan keduanya (lihat weekTypesOverlap di bawah).
    const rotatingClasses = classes
      .filter(c => c.grade === 10 || c.grade === 11 || c.grade === 12)
      .sort((a, b) => a.grade - b.grade || a.name.localeCompare(b.name));

    // classId|subjectName -> kode guru & kode mapel yang SUDAH ADA di data (bukan bikin baru) —
    // dipakai supaya sel tabel tampil persis seperti tabel cetak sekolah (mis. "A" "12").
    const codeIndex = new Map<string, { teacherCode: string; subjectCode: number; teacherId: string }>();
    for (const a of allAssignments) {
      codeIndex.set(`${a.classId}|${a.subject.name}`, {
        teacherCode: a.teacher.shortCode ?? "?", subjectCode: a.subject.code, teacherId: a.teacherId,
      });
    }

    const scheduleIndex = new Map<string, ScheduleRow>();
    for (const s of teacherSchedules) {
      if (!weekTypesOverlap(s.weekType, gridWeek)) continue;
      scheduleIndex.set(`${s.classId}|${s.day}|${s.startTime}`, s);
    }

    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <button onClick={() => setShowGrid(v => !v)} className="flex items-center gap-1.5 text-xs font-bold text-primary-900">
            <Table2 size={14} /> Tabel Jadwal Referensi (Live)
            {showGrid ? <ChevronUp size={12} className="text-gray-400" /> : <ChevronDown size={12} className="text-gray-400" />}
          </button>
          {showGrid && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-gray-100 rounded-full p-0.5">
                {(["A", "B"] as const).map(w => (
                  <button key={w} onClick={() => setGridWeek(w)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition ${gridWeek === w ? "bg-primary-700 text-white" : "text-gray-500 hover:text-gray-700"}`}>
                    {w === "A" ? "Minggu 1" : "Minggu 2"}
                  </button>
                ))}
              </div>
              <button onClick={exportGridExcel} disabled={exportingGrid}
                title="Ekspor Minggu 1 & 2 ke Excel (.xlsx) berwarna, persis seperti tabel ini"
                className="flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition disabled:opacity-60">
                {exportingGrid ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />} Ekspor Excel
              </button>
            </div>
          )}
        </div>
        {showGrid && (
          <div className="overflow-auto max-h-[70vh]">
            <table className="text-[9px] border-collapse w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 bg-primary-900 text-white px-1 py-1 z-20 min-w-[36px]">Hari</th>
                  <th className="sticky top-0 bg-primary-900 text-white px-1 py-1 z-10 min-w-[52px]">Waktu</th>
                  {rotatingClasses.map(c => (
                    <th key={c.id} className="sticky top-0 bg-primary-900 text-white px-0.5 py-1 z-10 min-w-[30px] whitespace-nowrap">{c.name.replace(/^(X|XI)\s/, "")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAYS.map(day => {
                  const dayPeriods = periodsForDay(day);
                  const rows = allPeriodsForDay(day);

                  // Jam yang direquest tapi belum tercermin di jadwal tergenerate, per kelas+jam mulai.
                  const pendingByCell = new Map<string, { subjectName: string; teacherCode: string; subjectCode: number; teacherId: string }[]>();
                  for (const a of allAssignments) {
                    for (const p of a.preferences) {
                      if (p.day !== day) continue;
                      if (!weekTypesOverlap(p.weekType, gridWeek)) continue;
                      const startIdx = dayPeriods.findIndex(x => x.startTime === p.startTime);
                      if (startIdx === -1) continue;
                      for (let i = startIdx; i < Math.min(startIdx + p.hours, dayPeriods.length); i++) {
                        const key = `${a.classId}|${dayPeriods[i].startTime}`;
                        if (!pendingByCell.has(key)) pendingByCell.set(key, []);
                        pendingByCell.get(key)!.push({ subjectName: a.subject.name, teacherCode: a.teacher.shortCode ?? "?", subjectCode: a.subject.code, teacherId: a.teacherId });
                      }
                    }
                  }

                  return rows.map((row, ri) => (
                    <tr key={row.id} className="border-b border-gray-50">
                      {ri === 0 && (
                        <td rowSpan={rows.length} className="sticky left-0 bg-primary-50 text-primary-900 font-bold px-1 py-0.5 align-top border-r border-gray-100">
                          {DAY_LABEL[day].slice(0, 3)}
                        </td>
                      )}
                      <td className="px-1 py-0.5 text-gray-400 whitespace-nowrap border-r border-gray-100">{row.startTime}</td>
                      {row.isBreak ? (
                        <td colSpan={rotatingClasses.length} className="px-1 py-0.5 text-center text-[8px] font-semibold text-violet-700 bg-violet-50 truncate">
                          {row.label ?? "Istirahat"}
                        </td>
                      ) : (
                        rotatingClasses.map(c => {
                          const sched = scheduleIndex.get(`${c.id}|${day}|${row.startTime}`);
                          const pending = pendingByCell.get(`${c.id}|${row.startTime}`) ?? [];
                          const distinctPending = [...new Map(pending.map(p => [p.subjectName, p])).values()];
                          const conflict = distinctPending.length > 1 || (!!sched && distinctPending.length === 1 && distinctPending[0].subjectName !== sched.subject);

                          if (conflict) {
                            const names = [sched?.subject, ...distinctPending.map(p => p.subjectName)].filter((v, i, arr) => v && arr.indexOf(v) === i);
                            return (
                              <td key={c.id} title={`Bentrok: ${names.join(" vs ")}`} className="px-0.5 py-0.5 text-center bg-red-200 text-red-900 font-bold">
                                ⚠
                              </td>
                            );
                          }
                          if (sched) {
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
                          }
                          if (distinctPending.length === 1) {
                            const p = distinctPending[0];
                            const color = colorForTeacherCode(p.teacherCode);
                            return (
                              <td key={c.id} title={`${p.subjectName} (request, belum digenerate)`}
                                style={{ background: color.bg, color: color.text }}
                                className="px-0 py-0.5 text-center font-bold border-2 border-dashed border-current opacity-70">
                                <div className="flex divide-x divide-current/20 justify-center leading-tight">
                                  <span className="px-0.5">{p.teacherCode}</span>
                                  <span className="px-0.5">{p.subjectCode}</span>
                                </div>
                              </td>
                            );
                          }
                          return <td key={c.id} className="px-0.5 py-0.5 text-center text-gray-300">·</td>;
                        })
                      )}
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        )}
        {showGrid && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-t border-gray-100 text-[9px] text-gray-500">
            <span>Kotak: <strong>kode guru</strong> | <strong>kode mapel</strong> · warna = guru</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-blue-100 border-2 border-dashed border-blue-400 inline-block opacity-70" /> belum digenerate</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-red-200 inline-block" /> bentrok</span>
            <span className="flex items-center gap-1"><span className="text-gray-300">·</span> kosong</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<UserCog size={22} />}
        title="Penugasan Mengajar"
        description="Tentukan guru pengampu tiap mata pelajaran per kelas — dipakai sebagai dasar Generate Jadwal Otomatis"
        actions={
          <Link href={`${basePath}/print`}
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            <Printer size={16} /> Cetak Pembagian Tugas Mengajar
          </Link>
        }
      />

      <div className="grid grid-cols-1 2xl:grid-cols-[1.6fr_1fr] gap-6 items-start">
        <div className="min-w-0">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Pilih Kelas</label>
            {classes.length === 0 ? (
              <p className="text-sm text-gray-400">
                Belum ada kelas. Tambahkan kelas dulu di menu{" "}
                <a href="/dashboard/admin/classes" className="text-primary-700 font-semibold hover:underline">Kelas</a>.
              </p>
            ) : (
              <>
                <div className="inline-block w-64">
                  <Select
                    value={selectedClass}
                    onChange={v => setSelectedClass(v)}
                    options={classes.map(c => {
                      const total = classTotalHours(c);
                      const target = TARGET_JP[c.grade];
                      const mark = total === target ? "✓" : "⚠";
                      return { value: c.id, label: `${c.name} — ${c.major.name} (${mark} ${total}/${target} JP)` };
                    })}
                  />
                </div>
                {activeClass && (
                  <span className="ml-3 text-xs text-gray-500">
                    Kelas {activeClass.grade} · {activeClass.major.name} · {assignedHours}/{totalHours} jam sudah ditugaskan
                  </span>
                )}
                {activeClass && targetHours !== undefined && (
                  totalHours === targetHours ? (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full align-middle">
                      <CheckCircle2 size={11} /> {totalHours} JP (pas {targetHours})
                    </span>
                  ) : (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full align-middle">
                      <AlertTriangle size={11} /> {totalHours} JP ({totalHours < targetHours ? `kurang ${targetHours - totalHours}` : `lebih ${totalHours - targetHours}`} dari {targetHours})
                    </span>
                  )
                )}
              </>
            )}
          </div>

          {applicableSubjects.length > 0 && assignedHours < totalHours && (
            <Alert variant="warning" className="mb-4">
              Masih ada {totalHours - assignedHours} jam mata pelajaran di kelas ini yang belum punya guru pengampu — mapel tersebut tidak akan ikut dijadwalkan saat Generate Jadwal Otomatis dijalankan.
            </Alert>
          )}

          {applicableSubjects.length > 0 && (
            <Alert variant="info" className="mb-4">
              {activeClass && (activeClass.grade === 10 || activeClass.grade === 11) ? (
                <>Saat memilih jam pada Preferensi Hari/Jam, pilihan yang guru itu sudah pakai mengajar kelas <strong>X/XI</strong> lain di minggu yang sama otomatis disembunyikan. Bentrok dengan kelas <strong>XII</strong> diabaikan (kelas XII sifatnya formalitas dan akan menyesuaikan belakangan saat Generate Otomatis) — jadi kelas X/XI selalu diprioritaskan.</>
              ) : (
                <>Kelas XII diproses belakangan saat Generate Otomatis dan akan menyesuaikan ke jadwal kelas X/XI — pilihan jam yang bentrok dengan kelas X/XI otomatis disembunyikan di sini.</>
              )}
            </Alert>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="animate-spin text-primary-500" size={32} /></div>
          ) : applicableSubjects.length === 0 ? (
            <Alert variant="warning">
              Belum ada mata pelajaran untuk jenjang/jurusan kelas ini. Tambahkan dulu di menu{" "}
              <a href={subjectsHref} className="underline font-semibold">Kode Mata Pelajaran</a>.
            </Alert>
          ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-primary-100"
                style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-16">Kode</th>
                <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Mata Pelajaran</th>
                <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-28">Jam/Minggu</th>
                <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Guru Pengampu</th>
              </tr>
            </thead>
            <tbody>
              {applicableSubjects.map(s => {
                const current = assignments.find(a => a.subjectId === s.id);
                const isRotating = activeClass ? (activeClass.grade === 10 || activeClass.grade === 11) : false;
                const prefTarget = s.hoursPerWeek * (isRotating ? 2 : 1);
                const prefTotal = current?.preferences.reduce((sum, p) => sum + p.hours, 0) ?? 0;
                const d = draft[s.id] ?? { day: "", startTime: "", endTime: "", weekType: "SEMUA" };
                const dOpts = d.day ? periodsForDay(d.day) : [];
                const occ = d.day && current
                  ? new Set([...occupiedStartTimes(d.day, s.id, d.weekType), ...teacherBusyStartTimes(d.day, current.teacherId, d.weekType, selectedClass, s.name, isRotating, current.id, s.maxSharedTeacher)])
                  : new Set<string>();
                const startIdxOf = (t: string) => dOpts.findIndex(p => p.startTime === t);
                const startOptions = dOpts.filter(p => !occ.has(p.startTime));
                // Pilihan "Selesai" dibatasi sampai jam bolong PERTAMA saja (bukan seluruh sisa
                // hari) — supaya tidak bisa pilih rentang yang melompati jam yang sudah dipakai
                // di tengah-tengah (blok harus benar-benar berurutan tanpa celah).
                let endOptions: PeriodItem[] = [];
                if (d.startTime) {
                  const sIdx = startIdxOf(d.startTime);
                  for (let i = sIdx; i < dOpts.length; i++) {
                    if (occ.has(dOpts[i].startTime)) break;
                    endOptions.push(dOpts[i]);
                  }
                }
                const canAddBlock = !!(current && d.day && d.startTime && d.endTime);
                return (
                  <Fragment key={s.id}>
                  <tr className={`hover:bg-primary-50/30 transition-colors ${current ? "" : "border-b border-gray-50 last:border-0"}`}>
                    <td className="px-5 py-3.5 font-mono text-xs text-gray-500">{s.code}</td>
                    <td className="px-5 py-3.5 font-semibold text-primary-900">{s.name}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">{s.hoursPerWeek} jam</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0 max-w-sm">
                          <Select
                            value={current?.teacherId ?? ""}
                            onChange={v => setTeacherFor(s.id, v)}
                            options={teachers.map(t => ({ value: t.id, label: `${t.user.name} (${t.subject})` }))}
                            placeholder="-- Belum ditugaskan --"
                          />
                        </div>
                        {savingId === s.id && <Loader2 size={14} className="animate-spin text-primary-400 shrink-0" />}
                        {current && savingId !== s.id && (
                          <button onClick={() => setTeacherFor(s.id, "")} title="Hapus penugasan"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition shrink-0">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {current && (
                    <tr className="border-b border-gray-50 last:border-0">
                      <td colSpan={4} className="px-5 pb-3.5 pt-0">
                        <div className="bg-gray-50/70 rounded-xl px-3 py-2.5 space-y-2">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Preferensi Hari/Jam (opsional)</span>
                            {current.preferences.length > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${prefTotal >= prefTarget ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                                {prefTotal}/{prefTarget} jam
                              </span>
                            )}
                          </div>
                          {current.preferences.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1">
                              {current.preferences.map(pref => {
                                const dp = periodsForDay(pref.day);
                                const startI = dp.findIndex(p => p.startTime === pref.startTime);
                                const endP = dp[Math.min(startI + pref.hours - 1, dp.length - 1)];
                                const weekTag = isRotating && pref.weekType !== "SEMUA" && activeClass
                                  ? ` · ${weekLabel(activeClass.grade, pref.weekType)}`
                                  : "";
                                return (
                                  <span key={pref.id} className="inline-flex items-center gap-1 text-[10px] font-semibold bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
                                    {DAY_LABEL[pref.day]} Ke-{startI + 1}–{startI + pref.hours} ({pref.hours}j, {pref.startTime}–{endP?.endTime ?? ""}){weekTag}
                                    <button onClick={() => removePreferenceBlock(current.id, pref.id)} className="hover:text-red-600"><X size={10} /></button>
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <div className="w-28 shrink-0">
                              <Select
                                value={d.day}
                                onChange={v => setDraft(prev => ({ ...prev, [s.id]: { ...d, day: v, startTime: "", endTime: "" } }))}
                                options={DAYS.map(day => ({ value: day, label: DAY_LABEL[day] }))}
                                placeholder="Hari"
                              />
                            </div>
                            <div className="w-24 shrink-0">
                              <Select
                                value={d.startTime}
                                onChange={v => setDraft(prev => ({ ...prev, [s.id]: { ...d, startTime: v, endTime: "" } }))}
                                options={startOptions.map((p) => ({ value: p.startTime, label: `Ke-${startIdxOf(p.startTime) + 1}` }))}
                                placeholder="Mulai"
                              />
                            </div>
                            <div className="w-24 shrink-0">
                              <Select
                                value={d.endTime}
                                onChange={v => setDraft(prev => ({ ...prev, [s.id]: { ...d, endTime: v } }))}
                                options={endOptions.map((p) => ({ value: p.startTime, label: `Ke-${startIdxOf(p.startTime) + 1}` }))}
                                placeholder="Selesai"
                              />
                            </div>
                            {isRotating && activeClass && (
                              <div className="w-40 shrink-0">
                                <Select
                                  value={d.weekType}
                                  onChange={v => setDraft(prev => ({ ...prev, [s.id]: { ...d, weekType: v, startTime: "", endTime: "" } }))}
                                  options={[
                                    { value: "SEMUA", label: "Minggu Manapun" },
                                    { value: "A", label: weekLabel(activeClass.grade, "A") },
                                    { value: "B", label: weekLabel(activeClass.grade, "B") },
                                  ]}
                                  placeholder="Minggu"
                                />
                              </div>
                            )}
                            <button
                              disabled={!canAddBlock || savingId === current?.id}
                              onClick={async () => {
                                const hours = startIdxOf(d.endTime) - startIdxOf(d.startTime) + 1;
                                await addPreferenceBlock(current.id, d.day, d.startTime, hours, d.weekType);
                                setDraft(prev => { const cp = { ...prev }; delete cp[s.id]; return cp; });
                              }}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-lg bg-primary-700 hover:bg-primary-800 text-white disabled:opacity-30 shrink-0">
                              + Tambah
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
          )}
        </div>

        <div className="xl:sticky xl:top-6">
          {renderScheduleGrid()}
        </div>
      </div>
    </div>
  );
}
