"use client";
import { useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

interface Student {
  id: string;
  nis: string;
  user: { name: string };
}

interface ClassInfo {
  id: string;
  name: string;
  grade: number;
  major: { name: string };
}

interface GradeRow {
  studentId: string;
  score: string;
  saved: boolean;
}

const GRADE_TYPES = ["Tugas", "Ulangan Harian", "UTS", "UAS", "Praktik"];

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [
    `Ganjil ${prevTahunAjaran}`,
    `Genap ${prevTahunAjaran}`,
    `Ganjil ${currentTahunAjaran}`,
    `Genap ${currentTahunAjaran}`,
  ];
}

const SEMESTERS = generateSemesters();

export default function InputNilaiPage() {
  const { classId } = useParams<{ classId: string }>();
  const [cls, setCls] = useState<ClassInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [subject, setSubject] = useState("");
  const [gradeType, setGradeType] = useState(GRADE_TYPES[0]);
  const [semester, setSemester] = useState(SEMESTERS[0]);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [studentsBase, setStudentsBase] = useState<Student[]>([]);

  useEffect(() => {
    Promise.all([
      fetch(`/api/teacher/students?classId=${classId}`).then(r => r.json()),
      fetch("/api/teacher/classes").then(r => r.json()),
    ]).then(([studentList, classes]) => {
      if (Array.isArray(studentList)) {
        setStudents(studentList);
        setStudentsBase(studentList);
        setRows(studentList.map((s: Student) => ({ studentId: s.id, score: "", saved: false })));
      }
      if (Array.isArray(classes)) {
        const found = classes.find((c: ClassInfo) => c.id === classId);
        if (found) setCls(found);
      }
      setLoading(false);
    });
  }, [classId]);

  // Load existing grades when subject/type/semester changes (min 3 chars)
  useEffect(() => {
    if (subject.trim().length < 3 || studentsBase.length === 0) return;
    setLoadingGrades(true);
    const params = new URLSearchParams({ classId, subject: subject.trim() });
    fetch(`/api/teacher/grades?${params}`)
      .then(r => r.json())
      .then(existingGrades => {
        if (!Array.isArray(existingGrades)) { setLoadingGrades(false); return; }
        const subjectTrim = subject.trim();
        const filtered = existingGrades.filter(
          (g: { subject: string; type: string; semester: string }) =>
            g.subject === subjectTrim && g.type === gradeType && g.semester === semester
        );
        setRows(studentsBase.map(s => {
          const existing = filtered.find((g: { student: { id: string }; score: number }) => g.student.id === s.id);
          return { studentId: s.id, score: existing ? String(existing.score) : "", saved: !!existing };
        }));
        setLoadingGrades(false);
      });
  }, [subject, gradeType, semester, studentsBase, classId]);

  function updateScore(studentId: string, score: string) {
    setRows(prev => prev.map(r => r.studentId === studentId ? { ...r, score, saved: false } : r));
  }

  async function handleSave() {
    if (!subject.trim()) { alert("Isi nama mata pelajaran terlebih dahulu"); return; }
    const toSave = rows.filter(r => r.score !== "" && !isNaN(Number(r.score)));
    if (toSave.length === 0) { alert("Belum ada nilai yang diisi"); return; }

    startTransition(async () => {
      const res = await fetch("/api/teacher/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grades: toSave.map(r => ({ studentId: r.studentId, subject, type: gradeType, semester, score: Number(r.score) })) }),
      });
      if (res.ok) {
        setSaved(true);
        setRows(prev => prev.map(r => toSave.find(t => t.studentId === r.studentId) ? { ...r, saved: true } : r));
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard/teacher/grades" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary-900">Input Nilai Siswa</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {cls ? `${cls.name} — ${cls.major.name}` : "Memuat..."}
          </p>
        </div>
      </div>

      {/* Form header */}
      <div className="bg-white rounded-2xl shadow-sm border p-5 mb-5 grid sm:grid-cols-3 gap-4">
        <div>
          <label className="label-field">Mata Pelajaran</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Contoh: Matematika" className="input-field" />
        </div>
        <div>
          <label className="label-field">Jenis Penilaian</label>
          <select value={gradeType} onChange={e => setGradeType(e.target.value)} className="input-field">
            {GRADE_TYPES.map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label-field">Semester</label>
          <select value={semester} onChange={e => setSemester(e.target.value)} className="input-field">
            {SEMESTERS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Tabel nilai */}
      <div className="bg-white rounded-2xl shadow-sm border overflow-hidden mb-5">
        {(loading || loadingGrades) ? (
          <div className="py-16 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" />
            {loading ? "Memuat daftar siswa..." : "Memuat nilai tersimpan..."}
          </div>
        ) : students.length === 0 ? (
          <div className="py-16 text-center text-gray-400">Tidak ada siswa di kelas ini.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium w-8">#</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">NIS</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Nama Siswa</th>
                <th className="text-center px-5 py-3 text-gray-500 font-medium w-32">Nilai (0-100)</th>
                <th className="text-center px-5 py-3 text-gray-500 font-medium w-20">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => {
                const row = rows.find(r => r.studentId === s.id);
                const score = Number(row?.score);
                return (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400">{i + 1}</td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{s.nis}</td>
                    <td className="px-5 py-3 font-medium text-primary-900">{s.user.name}</td>
                    <td className="px-5 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={row?.score ?? ""}
                        onChange={e => updateScore(s.id, e.target.value)}
                        placeholder="—"
                        className={`w-full text-center border rounded-lg px-2 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-300 ${
                          row?.score && score < 75 ? "border-red-300 text-red-600" : row?.score ? "border-emerald-300 text-emerald-700" : "border-gray-200"
                        }`}
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      {row?.saved ? (
                        <span className="text-xs text-emerald-600 font-semibold">✓ Tersimpan</span>
                      ) : row?.score ? (
                        <span className={`text-xs font-semibold ${score >= 75 ? "text-emerald-500" : "text-red-400"}`}>
                          {score >= 75 ? "Tuntas" : "Remedial"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">{rows.filter(r => r.score !== "").length} dari {students.length} siswa diisi</p>
        <div className="flex gap-3">
          {saved && <p className="text-emerald-600 text-sm font-semibold self-center">✓ Nilai berhasil disimpan!</p>}
          <button onClick={handleSave} disabled={isPending} className="btn-gold flex items-center gap-2 text-sm">
            <Save size={16} /> {isPending ? "Menyimpan..." : "Simpan Nilai"}
          </button>
        </div>
      </div>
    </div>
  );
}
