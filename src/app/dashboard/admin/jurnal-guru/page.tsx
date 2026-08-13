"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { NotebookPen, Loader2, Printer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";

interface TeacherOpt { teacherId: string; name: string }
interface TeachClass { classId: string; className: string; grade: number; subjectId: string; subjectName: string }
interface HistoryRow {
  id: string; date: string; className: string; subject: string; materi: string;
  hadir: number; izin: number; sakit: number; alpha: number;
  avgPengetahuan: number | null; avgKeterampilan: number | null; catatanCount: number;
}

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [`Ganjil ${prevTahunAjaran}`, `Genap ${prevTahunAjaran}`, `Ganjil ${currentTahunAjaran}`, `Genap ${currentTahunAjaran}`];
}
const SEMESTERS = generateSemesters();

export default function AdminJurnalGuruPage() {
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [classKey, setClassKey] = useState("");
  const [semester, setSemester] = useState(SEMESTERS[2]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetch("/api/admin/journal/teachers").then(r => r.json()).then((d: TeacherOpt[]) => {
      setTeachers(d);
      if (d.length > 0) setTeacherId(d[0].teacherId);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }, []);

  useEffect(() => {
    if (!teacherId) return;
    setClassKey("");
    fetch(`/api/admin/journal/classes?teacherId=${teacherId}`).then(r => r.json()).then((d: TeachClass[]) => {
      setClasses(d);
      if (d.length > 0) setClassKey(`${d[0].classId}::${d[0].subjectName}`);
    }).catch(() => {});
  }, [teacherId]);

  const selected = useMemo(() => {
    const [classId, subjectName] = classKey.split("::");
    return classes.find(c => c.classId === classId && c.subjectName === subjectName) ?? null;
  }, [classKey, classes]);

  useEffect(() => {
    if (!selected || !teacherId) return;
    setLoadingHistory(true);
    fetch(`/api/teacher/journal/history?teacherId=${teacherId}&classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&semester=${encodeURIComponent(semester)}`)
      .then(r => r.json()).then(d => { setHistory(Array.isArray(d) ? d : []); setLoadingHistory(false); }).catch(() => { setLoadingHistory(false); });
  }, [selected, teacherId, semester]);

  const printHref = selected
    ? `/dashboard/admin/jurnal-guru/cetak?teacherId=${teacherId}&classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&semester=${encodeURIComponent(semester)}`
    : "#";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<NotebookPen size={22} />}
        title="Jurnal Mengajar Guru"
        description="Lihat & cetak rekap jurnal mengajar (materi, kehadiran, nilai, catatan siswa) per guru, kelas, dan semester"
      />

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : teachers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
          Belum ada guru dengan penugasan mengajar.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label-field">Guru</label>
                <Select value={teacherId} onChange={setTeacherId} options={teachers.map(t => ({ value: t.teacherId, label: t.name }))} />
              </div>
              <div>
                <label className="label-field">Kelas & Mapel</label>
                <Select value={classKey} onChange={setClassKey}
                  options={classes.map(c => ({ value: `${c.classId}::${c.subjectName}`, label: `${c.className} — ${c.subjectName}` }))}
                  placeholder={classes.length === 0 ? "Guru ini belum ada penugasan" : undefined} />
              </div>
              <div>
                <label className="label-field">Semester</label>
                <Select value={semester} onChange={setSemester} options={SEMESTERS.map(s => ({ value: s, label: s }))} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-heading font-bold text-primary-900 text-sm">Riwayat Pertemuan</h3>
              {selected && (
                <Link href={printHref} className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-900 font-semibold">
                  <Printer size={13} /> Cetak Rekap
                </Link>
              )}
            </div>
            {loadingHistory ? (
              <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin text-primary-500" /></div>
            ) : history.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Belum ada pertemuan tercatat untuk pilihan ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 border-b border-gray-100">
                      <th className="py-2 pr-3">Tanggal</th>
                      <th className="py-2 pr-3">Materi</th>
                      <th className="py-2 pr-3">H/I/S/A</th>
                      <th className="py-2 pr-3">Rata Pengetahuan</th>
                      <th className="py-2 pr-3">Rata Keterampilan</th>
                      <th className="py-2 pr-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-b border-gray-50 last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap">{new Date(h.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                        <td className="py-2 pr-3 max-w-xs truncate">{h.materi}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-xs">{h.hadir}/{h.izin}/{h.sakit}/{h.alpha}</td>
                        <td className="py-2 pr-3">{h.avgPengetahuan ?? "—"}</td>
                        <td className="py-2 pr-3">{h.avgKeterampilan ?? "—"}</td>
                        <td className="py-2 pr-3 text-xs text-gray-400">{h.catatanCount > 0 ? `${h.catatanCount} siswa` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
