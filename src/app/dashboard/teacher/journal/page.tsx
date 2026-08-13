"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { NotebookPen, Loader2, Save, Printer, Users, Pencil } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useToast } from "@/components/shared/ToastProvider";
import DatePicker from "@/components/shared/DatePicker";

interface TeachClass {
  classId: string; className: string; grade: number; subjectId: string; subjectName: string;
}
interface JournalRow {
  studentId: string; nis: string; name: string;
  attendanceStatus: string; scorePengetahuan: number | null; scoreKeterampilan: number | null; catatan: string;
}
interface HistoryRow {
  id: string; date: string; classId: string; className: string; subject: string; materi: string;
  hadir: number; izin: number; sakit: number; alpha: number;
  avgPengetahuan: number | null; avgKeterampilan: number | null; catatanCount: number;
}

const ATTENDANCE_OPTIONS = [
  { value: "HADIR", label: "Hadir" },
  { value: "IZIN", label: "Izin" },
  { value: "SAKIT", label: "Sakit" },
  { value: "ALPHA", label: "Alfa" },
];

function generateSemesters(): string[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const currentTahunAjaran = month >= 7 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
  const prevTahunAjaran = month >= 7 ? `${year - 1}/${year}` : `${year - 2}/${year - 1}`;
  return [`Ganjil ${prevTahunAjaran}`, `Genap ${prevTahunAjaran}`, `Ganjil ${currentTahunAjaran}`, `Genap ${currentTahunAjaran}`];
}
const SEMESTERS = generateSemesters();

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function TeacherJournalPage() {
  const toast = useToast();
  const formRef = useRef<HTMLDivElement>(null);
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [classKey, setClassKey] = useState(""); // `${classId}::${subjectName}`
  const [date, setDate] = useState(todayStr());
  const [semester, setSemester] = useState(SEMESTERS[2]);
  const [materi, setMateri] = useState("");
  const [rows, setRows] = useState<JournalRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  // Kelas+mapel yg "ditarget" saat klik Edit dari Riwayat — dipakai sekali begitu daftar kelas
  // hari itu selesai dimuat, lalu dikosongkan lagi. Tanpa ini, effect di bawah selalu memaksa
  // classKey balik ke kelas pertama hari itu tiap tanggal berubah, menimpa pilihan dari Edit.
  const pendingClassKeyRef = useRef<string | null>(null);

  // Daftar kelas+mapel di-refetch tiap tanggal berubah — cuma yang BENAR-BENAR terjadwal hari itu
  // (bukan semua Penugasan Mengajar guru) yang ditampilkan, biar tidak perlu scroll kelas yang
  // tidak relevan hari ini.
  useEffect(() => {
    fetch(`/api/teacher/journal-classes?date=${date}`).then(r => r.json()).then((d: TeachClass[]) => {
      setClasses(d);
      const pending = pendingClassKeyRef.current;
      pendingClassKeyRef.current = null;
      if (pending && d.some(c => `${c.classId}::${c.subjectName}` === pending)) {
        setClassKey(pending);
      } else {
        setClassKey(d.length > 0 ? `${d[0].classId}::${d[0].subjectName}` : "");
      }
    }).catch(() => {});
  }, [date]);

  function editHistoryRow(h: HistoryRow) {
    const dateOnly = new Date(h.date).toISOString().slice(0, 10);
    pendingClassKeyRef.current = `${h.classId}::${h.subject}`;
    setDate(dateOnly);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const selected = useMemo(() => {
    const [classId, subjectName] = classKey.split("::");
    return classes.find(c => c.classId === classId && c.subjectName === subjectName) ?? null;
  }, [classKey, classes]);

  useEffect(() => {
    if (!selected) return;
    setLoadingRows(true);
    fetch(`/api/teacher/journal?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&date=${date}`)
      .then(r => r.json())
      .then(d => { setMateri(d.materi ?? ""); setRows(d.rows ?? []); })
      .catch(() => {})
      .finally(() => setLoadingRows(false));
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, date]);

  function loadHistory() {
    if (!selected) return;
    fetch(`/api/teacher/journal/history?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&semester=${encodeURIComponent(semester)}`)
      .then(r => r.json()).then(d => setHistory(Array.isArray(d) ? d : [])).catch(() => {});
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadHistory(); }, [semester]);

  function updateRow(studentId: string, patch: Partial<JournalRow>) {
    setRows(rs => rs.map(r => r.studentId === studentId ? { ...r, ...patch } : r));
  }

  async function handleSave() {
    if (!selected) return;
    if (!materi.trim()) { toast.warning("Materi yang diajarkan wajib diisi."); return; }
    const missing = rows.filter(r => !r.attendanceStatus);
    if (missing.length > 0) {
      toast.warning(`${missing.length} siswa belum diisi status kehadirannya: ${missing.slice(0, 3).map(r => r.name).join(", ")}${missing.length > 3 ? ", dst." : ""}`);
      return;
    }
    setSaving(true);
    const res = await fetch("/api/teacher/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: selected.classId, subject: selected.subjectName, date, semester, materi, rows }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan jurnal"); return; }
    loadHistory();
    toast.success("Jurnal pertemuan tersimpan.");
  }

  const printHref = selected
    ? `/dashboard/teacher/journal/cetak?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}&semester=${encodeURIComponent(semester)}`
    : "#";

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<NotebookPen size={22} />}
        title="Jurnal Mengajar"
        description="Catat kehadiran, nilai, materi, dan catatan siswa setiap pertemuan"
      />

      {/* Tanggal & Semester SELALU tampil di luar — supaya guru tetap bisa ganti tanggal walau
          hari yang lagi dipilih kebetulan tidak ada jadwal mengajar sama sekali. */}
      <div ref={formRef} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 scroll-mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="label-field">Tanggal Pertemuan</label>
            <DatePicker value={date} onChange={setDate} />
          </div>
          {classes.length > 0 && (
            <div>
              <label className="label-field">Kelas & Mapel</label>
              <Select value={classKey} onChange={setClassKey}
                options={classes.map(c => ({ value: `${c.classId}::${c.subjectName}`, label: `${c.className} — ${c.subjectName}` }))} />
            </div>
          )}
          <div>
            <label className="label-field">Semester</label>
            <Select value={semester} onChange={setSemester} options={SEMESTERS.map(s => ({ value: s, label: s }))} />
          </div>
        </div>
        {classes.length > 0 && (
          <div className="mt-4">
            <label className="label-field">Materi yang Diajarkan</label>
            <textarea value={materi} onChange={e => setMateri(e.target.value)} rows={2}
              placeholder="Contoh: Jurnal Umum &amp; Buku Besar — latihan soal bab 3"
              className="input-field" />
          </div>
        )}
      </div>

      {classes.length === 0 ? (
        <EmptyState icon={Users} title="Tidak Ada Jadwal Mengajar" description="Anda tidak terjadwal mengajar kelas manapun pada tanggal ini. Ganti tanggal di atas, atau hubungi admin kalau jadwal belum diatur." />
      ) : (
        <>
          {loadingRows ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                      <th className="text-left px-4 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-10">#</th>
                      <th className="text-left px-4 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Nama Siswa</th>
                      <th className="text-left px-4 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-32">Kehadiran</th>
                      <th className="text-left px-4 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-28">Pengetahuan</th>
                      <th className="text-left px-4 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 w-28">Keterampilan</th>
                      <th className="text-left px-4 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Catatan Siswa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.studentId} className="border-b border-gray-50 last:border-0">
                        <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2 font-semibold text-primary-900">{r.name}</td>
                        <td className="px-4 py-2">
                          <Select value={r.attendanceStatus} onChange={v => updateRow(r.studentId, { attendanceStatus: v })} options={ATTENDANCE_OPTIONS} placeholder="Pilih" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min={0} max={100} value={r.scorePengetahuan ?? ""}
                            onChange={e => updateRow(r.studentId, { scorePengetahuan: e.target.value === "" ? null : Number(e.target.value) })}
                            className="input-field" placeholder="—" />
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min={0} max={100} value={r.scoreKeterampilan ?? ""}
                            onChange={e => updateRow(r.studentId, { scoreKeterampilan: e.target.value === "" ? null : Number(e.target.value) })}
                            className="input-field" placeholder="—" />
                        </td>
                        <td className="px-4 py-2">
                          <input value={r.catatan} onChange={e => updateRow(r.studentId, { catatan: e.target.value })}
                            className="input-field" placeholder="Catatan khusus (opsional)" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-50 flex justify-end">
                <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Jurnal Pertemuan
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Riwayat tidak tergantung ada/tidaknya jadwal hari ini — guru tetap bisa lihat rekap
          semester walau hari yang lagi dipilih kosong. */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-primary-900 text-sm">Riwayat Pertemuan — {semester}</h3>
          {selected && (
            <Link href={printHref} className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-900 font-semibold">
              <Printer size={13} /> Cetak Rekap
            </Link>
          )}
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">Belum ada pertemuan tercatat untuk semester ini.</p>
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
                  <th className="py-2 pr-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {history.map(h => (
                  <tr key={h.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="py-2 pr-3 whitespace-nowrap">{new Date(h.date).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td className="py-2 pr-3 max-w-xs truncate">{h.materi}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs">{h.hadir}/{h.izin}/{h.sakit}/{h.alpha}</td>
                    <td className="py-2 pr-3">{h.avgPengetahuan ?? "—"}</td>
                    <td className="py-2 pr-3">{h.avgKeterampilan ?? "—"}</td>
                    <td className="py-2 pr-3 text-xs text-gray-400">{h.catatanCount > 0 ? `${h.catatanCount} siswa` : "—"}</td>
                    <td className="py-2 pr-3 text-right">
                      <button onClick={() => editHistoryRow(h)}
                        className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-900 font-semibold">
                        <Pencil size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
