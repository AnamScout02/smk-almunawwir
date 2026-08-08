"use client";
import { useEffect, useState, useCallback } from "react";
import { ClipboardList, Loader2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";
import PrintButton from "@/components/shared/PrintButton";
import PrintKop from "@/components/shared/PrintKop";
import { useToast } from "@/components/shared/ToastProvider";

interface StudentRow { id: string; nis: string; name: string }
interface DknData { class: { name: string; grade: number; major: { name: string } | null }; students: StudentRow[]; subjects: string[]; scores: Record<string, Record<string, number | null>> }

function generateSemesters(): { list: string[]; currentIndex: number } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  const list = [`Ganjil ${prevTahunAjaran}`, `Genap ${prevTahunAjaran}`, `Ganjil ${currentTahunAjaran}`, `Genap ${currentTahunAjaran}`];
  // Juli-Desember = semester Ganjil tahun ajaran berjalan (index 2); Januari-Juni = Genap (index 3).
  return { list, currentIndex: month >= 7 ? 2 : 3 };
}
const { list: SEMESTERS, currentIndex: CURRENT_SEMESTER_INDEX } = generateSemesters();

export default function DknTable({ classId, logoUrl }: { classId: string; logoUrl?: string }) {
  const toast = useToast();
  const [semester, setSemester] = useState(SEMESTERS[CURRENT_SEMESTER_INDEX]);
  const [data, setData] = useState<DknData | null>(null);
  const [loading, setLoading] = useState(true);
  const [edits, setEdits] = useState<Record<string, string>>({}); // key `${studentId}::${subject}` -> input string sedang diketik
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/teacher/dkn/${classId}?semester=${encodeURIComponent(semester)}`).then(r => r.json())
      .then((d: DknData) => { setData(d); setEdits({}); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [classId, semester]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(studentId: string, subject: string, raw: string) {
    const key = `${studentId}::${subject}`;
    const current = data?.scores[studentId]?.[subject] ?? null;
    if (raw.trim() === "" || raw === String(current ?? "")) { setEdits(p => { const n = { ...p }; delete n[key]; return n; }); return; }
    const score = Number(raw);
    if (isNaN(score) || score < 0 || score > 100) { toast.error("Nilai harus angka 0-100."); return; }
    setSavingKey(key);
    const res = await fetch(`/api/teacher/dkn/${classId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, subject, semester, score }),
    });
    setSavingKey(null);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan nilai"); return; }
    setData(prev => prev ? { ...prev, scores: { ...prev.scores, [studentId]: { ...prev.scores[studentId], [subject]: score } } } : prev);
    setEdits(p => { const n = { ...p }; delete n[key]; return n; });
  }

  function rowAverage(studentId: string): number | null {
    if (!data) return null;
    const vals = data.subjects.map(s => data.scores[studentId]?.[s] ?? null).filter((v): v is number => v !== null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100 : null;
  }

  return (
    <div className="p-6 lg:p-8 print:p-0">
      <style>{"@page { size: A4 landscape; margin: 1cm; }"}</style>

      <div className="print:hidden">
        <PageHeader icon={<ClipboardList size={22} />} title="DKN — Daftar Kumpulan Nilai"
          description={data ? `${data.class.name} · ${data.class.major?.name ?? "—"}` : "Memuat..."} />
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-5 print:hidden">
        <div className="w-56">
          <Select value={semester} onChange={setSemester} options={SEMESTERS.map(s => ({ value: s, label: s }))} />
        </div>
        <span className="text-xs text-gray-400">Klik nilai untuk mengubah — otomatis tersimpan.</span>
        <div className="sm:ml-auto"><PrintButton /></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-400" size={28} /></div>
      ) : !data || data.students.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Belum Ada Siswa" description="Kelas ini belum punya siswa aktif." />
      ) : (
        <div className="print-doc">
          <div className="print:block hidden">
            <PrintKop title="Daftar Kumpulan Nilai (DKN)" subtitle="SMK Al Munawwir IIBS" logoUrl={logoUrl} edgeClassName="-mx-6 print:-mx-2" />
          </div>
          <div className="bg-gray-50 rounded-xl p-4 mb-5 grid grid-cols-3 gap-2 text-sm print:bg-transparent print:border print:border-gray-300 print:rounded-none">
            <div><span className="text-gray-500">Kelas</span><span className="mx-2">:</span><strong>{data.class.name}</strong></div>
            <div><span className="text-gray-500">Jurusan</span><span className="mx-2">:</span><strong>{data.class.major?.name ?? "—"}</strong></div>
            <div><span className="text-gray-500">Semester</span><span className="mx-2">:</span><strong>{semester}</strong></div>
          </div>

          {data.subjects.length === 0 ? (
            <EmptyState icon={ClipboardList} title="Belum Ada Mata Pelajaran" description="Belum ada Penugasan Mengajar untuk kelas ini." />
          ) : (
            <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm print:border-0 print:shadow-none print:rounded-none">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50 print:bg-gray-100">
                    <th className="border border-gray-200 px-2 py-2 text-center w-10">No</th>
                    <th className="border border-gray-200 px-3 py-2 text-left min-w-[160px]">Nama Siswa</th>
                    <th className="border border-gray-200 px-2 py-2 text-center w-24">NIS</th>
                    {data.subjects.map(s => (
                      <th key={s} className="border border-gray-200 px-2 py-2 text-center text-xs whitespace-nowrap">{s}</th>
                    ))}
                    <th className="border border-gray-200 px-2 py-2 text-center w-20">Rata-rata</th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((st, i) => {
                    const avg = rowAverage(st.id);
                    return (
                      <tr key={st.id} className="hover:bg-primary-50/30 print:hover:bg-transparent">
                        <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-400">{i + 1}</td>
                        <td className="border border-gray-200 px-3 py-1.5 font-medium text-primary-900">{st.name}</td>
                        <td className="border border-gray-200 px-2 py-1.5 text-center font-mono text-xs text-gray-500">{st.nis}</td>
                        {data.subjects.map(subject => {
                          const key = `${st.id}::${subject}`;
                          const cell = data.scores[st.id]?.[subject] ?? null;
                          const displayVal = edits[key] ?? (cell ?? "");
                          return (
                            <td key={subject} className="border border-gray-200 p-0.5 text-center">
                              <input
                                type="number" min={0} max={100} value={displayVal}
                                onChange={e => setEdits(p => ({ ...p, [key]: e.target.value }))}
                                onBlur={e => handleSave(st.id, subject, e.target.value)}
                                disabled={savingKey === key}
                                placeholder="—"
                                className={`w-14 text-center text-sm py-1 border-0 focus:ring-1 focus:ring-primary-400 rounded outline-none print:appearance-none ${
                                  cell !== null && cell < 75 ? "text-red-600" : "text-gray-700"
                                } ${savingKey === key ? "opacity-40" : ""}`}
                              />
                            </td>
                          );
                        })}
                        <td className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-primary-900">{avg ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[11px] text-gray-400 mt-3 print:hidden">
            Nilai bertanda merah &lt; 75. DKN murni input manual wali kelas — kolom kosong berarti memang belum diisi, tidak dihitung otomatis dari nilai manapun.
          </p>
        </div>
      )}
    </div>
  );
}
