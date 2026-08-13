"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FileQuestion, Loader2, Plus, Trash2, Users2, ChevronRight, Eye, EyeOff, KeyRound, BookMarked, LayoutDashboard, BarChart3, PlayCircle, CalendarClock, Trophy, TrendingUp } from "lucide-react";
import Select from "@/components/admin/Select";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface TeachClass { classId: string; className: string; grade: number; subjectId: string; subjectName: string }
interface BankItem { id: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }
interface ExamItem {
  id: string; title: string; token: string; duration: number; startTime: string; endTime: string; isPublished: boolean;
  class: { name: string }; _count: { questions: number; attempts: number };
  attempts: { score: number | null }[];
}

const EMPTY_BANK_FORM = { question: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A" };
const TABS = ["ringkasan", "ujian", "bank", "hasil"] as const;
type Tab = typeof TABS[number];
const TAB_LABEL: Record<Tab, string> = { ringkasan: "Ringkasan", ujian: "Daftar Ujian", bank: "Bank Soal", hasil: "Hasil & Analitik" };
const TAB_ICON: Record<Tab, React.ElementType> = { ringkasan: LayoutDashboard, ujian: FileQuestion, bank: BookMarked, hasil: BarChart3 };

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function examStatus(e: ExamItem): "AKAN_DATANG" | "BERLANGSUNG" | "SELESAI" {
  const now = Date.now();
  const start = new Date(e.startTime).getTime();
  const end = new Date(e.endTime).getTime();
  if (now < start) return "AKAN_DATANG";
  if (now > end) return "SELESAI";
  return "BERLANGSUNG";
}

function examScores(e: ExamItem): number[] {
  return e.attempts.map(a => a.score).filter((s): s is number => s !== null);
}

export default function UjianManager({ basePath }: { basePath: string }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [classes, setClasses] = useState<TeachClass[]>([]);
  const [classKey, setClassKey] = useState("");
  const [tab, setTab] = useState<Tab>("ringkasan");
  const [bankItems, setBankItems] = useState<BankItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [bankForm, setBankForm] = useState(EMPTY_BANK_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/journal-classes").then(r => r.json()).then((d: TeachClass[]) => {
      setClasses(d);
      if (d.length > 0) setClassKey(`${d[0].classId}::${d[0].subjectName}`);
    }).catch(() => {});
  }, []);

  const selected = useMemo(() => {
    const [classId, subjectName] = classKey.split("::");
    return classes.find(c => c.classId === classId && c.subjectName === subjectName) ?? null;
  }, [classKey, classes]);

  function loadList() {
    if (!selected) return;
    setLoadingList(true);
    Promise.all([
      fetch(`/api/teacher/exam-bank?subject=${encodeURIComponent(selected.subjectName)}`).then(r => r.json()).catch(() => []),
      fetch(`/api/teacher/exams?classId=${selected.classId}&subject=${encodeURIComponent(selected.subjectName)}`).then(r => r.json()).catch(() => []),
    ]).then(([bank, ex]) => {
      setBankItems(Array.isArray(bank) ? bank : []);
      setExams(Array.isArray(ex) ? ex : []);
    }).finally(() => setLoadingList(false));
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadList(); }, [selected]);
  useEffect(() => { setShowForm(false); setError(""); }, [tab]);

  async function handleAddBank() {
    if (!selected) return;
    const f = bankForm;
    if (!f.question.trim() || !f.optionA.trim() || !f.optionB.trim() || !f.optionC.trim() || !f.optionD.trim()) {
      setError("Semua field soal wajib diisi."); return;
    }
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/teacher/exam-bank", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: selected.subjectName, ...f }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
      setBankForm(EMPTY_BANK_FORM);
      setShowForm(false);
      loadList();
    } catch {
      setError("Koneksi bermasalah, coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteBank(id: string) {
    if (!(await confirmDialog("Hapus soal ini dari bank soal?"))) return;
    await fetch(`/api/teacher/exam-bank/${id}`, { method: "DELETE" });
    loadList();
  }

  async function handleDeleteExam(id: string, title: string) {
    if (!(await confirmDialog(`Hapus ujian "${title}" beserta semua hasil pengerjaan siswa?`))) return;
    await fetch(`/api/teacher/exams/${id}`, { method: "DELETE" });
    loadList();
  }

  function copyToken(token: string) {
    navigator.clipboard?.writeText(token);
    toast.success(`Token ${token} disalin`);
  }

  const berlangsung = exams.filter(e => examStatus(e) === "BERLANGSUNG");
  const akanDatang = exams.filter(e => examStatus(e) === "AKAN_DATANG").sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const allScores = exams.flatMap(examScores);
  const avgScoreAll = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  const totalPeserta = exams.reduce((sum, e) => sum + e._count.attempts, 0);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<FileQuestion size={22} />}
        title="Pusat Ujian Online (CBT)"
        description="Kelola bank soal, ujian, monitoring peserta, dan hasil — semua dalam satu tempat"
      />

      {classes.length === 0 ? (
        <EmptyState icon={Users2} title="Belum Ada Penugasan Mengajar" description="Hubungi admin untuk ditugaskan mengajar kelas/mapel terlebih dahulu." />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
            <label className="label-field">Kelas & Mapel</label>
            <Select value={classKey} onChange={setClassKey}
              options={classes.map(c => ({ value: `${c.classId}::${c.subjectName}`, label: `${c.className} — ${c.subjectName}` }))} />
          </div>

          <div className="flex items-center gap-2 mb-5 flex-wrap">
            {TABS.map(tb => {
              const Icon = TAB_ICON[tb];
              return (
                <button key={tb} onClick={() => setTab(tb)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === tb ? "bg-primary-700 text-white" : "bg-white text-gray-500 border border-gray-200 hover:border-primary-200"}`}>
                  <Icon size={14} /> {TAB_LABEL[tb]}
                </button>
              );
            })}
            {tab === "ujian" && (
              <Link href={`${basePath}/new?classId=${selected?.classId ?? ""}&subject=${encodeURIComponent(selected?.subjectName ?? "")}`}
                className="ml-auto btn-gold flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Buat Ujian
              </Link>
            )}
            {tab === "bank" && (
              <button onClick={() => setShowForm(s => !s)} className="ml-auto btn-gold flex items-center gap-1.5 text-xs">
                <Plus size={14} /> Tambah Soal
              </button>
            )}
          </div>

          {loadingList ? (
            <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
          ) : tab === "ringkasan" ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatTile color="primary" icon={FileQuestion} label="Total Ujian" value={exams.length} />
                <StatTile color="amber" icon={PlayCircle} label="Sedang Berlangsung" value={berlangsung.length} />
                <StatTile color="emerald" icon={Trophy} label="Rata-rata Nilai" value={avgScoreAll ?? "—"} />
                <StatTile color="purple" icon={BookMarked} label="Soal di Bank" value={bankItems.length || "—"} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-heading font-semibold text-navy text-sm mb-3 flex items-center gap-2"><PlayCircle size={15} className="text-amber-500" /> Sedang Berlangsung</h3>
                  {berlangsung.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Tidak ada ujian yang sedang berlangsung.</p>
                  ) : (
                    <div className="space-y-2">
                      {berlangsung.map(e => (
                        <Link key={e.id} href={`${basePath}/${e.id}`} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0 hover:text-primary-700">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-primary-900 truncate">{e.title}</p>
                            <p className="text-gray-400 text-xs">{e._count.attempts} peserta bergabung</p>
                          </div>
                          <ChevronRight size={14} className="text-gray-300 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <h3 className="font-heading font-semibold text-navy text-sm mb-3 flex items-center gap-2"><CalendarClock size={15} className="text-primary-500" /> Akan Datang</h3>
                  {akanDatang.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-8">Tidak ada jadwal ujian mendatang.</p>
                  ) : (
                    <div className="space-y-2">
                      {akanDatang.slice(0, 5).map(e => (
                        <Link key={e.id} href={`${basePath}/${e.id}`} className="flex items-center justify-between text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0 hover:text-primary-700">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-primary-900 truncate">{e.title}</p>
                            <p className="text-gray-400 text-xs">{fmtDateTime(e.startTime)}</p>
                          </div>
                          <ChevronRight size={14} className="text-gray-300 shrink-0" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm text-gray-500">Total <span className="font-bold text-primary-700">{totalPeserta}</span> pengerjaan tercatat dari <span className="font-bold text-primary-700">{exams.length}</span> ujian di kelas &amp; mapel ini.</p>
              </div>
            </div>
          ) : tab === "bank" ? (
            <>
              {showForm && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6 space-y-3">
                  {error && <p className="error-msg">{error}</p>}
                  <textarea value={bankForm.question} onChange={e => setBankForm(f => ({ ...f, question: e.target.value }))} rows={2}
                    className="input-field" placeholder="Tulis pertanyaan..." />
                  <div className="space-y-2">
                    {(["A", "B", "C", "D"] as const).map(opt => (
                      <div key={opt} className="flex items-center gap-2">
                        <button onClick={() => setBankForm(f => ({ ...f, correctAnswer: opt }))}
                          className={`w-7 h-7 shrink-0 rounded-full text-xs font-bold border-2 transition-colors ${
                            bankForm.correctAnswer === opt ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-200 text-gray-400 hover:border-emerald-300"
                          }`}>{opt}</button>
                        <input value={bankForm[`option${opt}` as "optionA"]} onChange={e => setBankForm(f => ({ ...f, [`option${opt}`]: e.target.value }))}
                          className="input-field flex-1" placeholder={`Pilihan ${opt}`} />
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setShowForm(false)} className="btn-modal-cancel text-sm px-4">Batal</button>
                    <button onClick={handleAddBank} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Simpan
                    </button>
                  </div>
                </div>
              )}
              {bankItems.length === 0 ? (
                <EmptyState icon={BookMarked} title="Bank Soal Kosong" description="Tambahkan soal untuk dipakai ulang saat membuat ujian." />
              ) : (
                <div className="space-y-3">
                  {bankItems.map(b => (
                    <div key={b.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-primary-900 mb-1">{b.question}</p>
                        <p className="text-xs text-gray-400">Kunci jawaban: <span className="font-bold text-emerald-600">{b.correctAnswer}</span></p>
                      </div>
                      <button onClick={() => handleDeleteBank(b.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors shrink-0"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : tab === "hasil" ? (
            exams.length === 0 ? (
              <EmptyState icon={BarChart3} title="Belum Ada Hasil" description="Hasil & analitik muncul setelah ada ujian dengan peserta yang mengerjakan." />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                        <th className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Ujian</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Peserta Selesai</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Rata-rata</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Tertinggi</th>
                        <th className="text-center px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70">Terendah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exams.map(e => {
                        const scores = examScores(e);
                        const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
                        const max = scores.length > 0 ? Math.max(...scores) : null;
                        const min = scores.length > 0 ? Math.min(...scores) : null;
                        return (
                          <tr key={e.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                            <td className="px-5 py-3.5">
                              <Link href={`${basePath}/${e.id}`} className="font-semibold text-primary-900 hover:text-primary-700">{e.title}</Link>
                            </td>
                            <td className="px-5 py-3.5 text-center text-gray-500">{scores.length}</td>
                            <td className="px-5 py-3.5 text-center">
                              {avg !== null ? <span className="font-bold text-primary-700 flex items-center justify-center gap-1"><TrendingUp size={13} />{avg}</span> : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-5 py-3.5 text-center text-emerald-600 font-semibold">{max ?? "—"}</td>
                            <td className="px-5 py-3.5 text-center text-red-500 font-semibold">{min ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          ) : exams.length === 0 ? (
            <EmptyState icon={FileQuestion} title="Belum Ada Ujian" description="Buat ujian online untuk kelas ini." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {exams.map(e => {
                const status = examStatus(e);
                return (
                <div key={e.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                  <Link href={`${basePath}/${e.id}`} className="group block mb-2">
                    <div className="flex items-start justify-between">
                      <p className="font-heading font-bold text-primary-900 group-hover:text-primary-700">{e.title}</p>
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-primary-500 transition-colors shrink-0" />
                    </div>
                  </Link>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <button onClick={() => copyToken(e.token)} title="Salin token"
                      className="inline-flex items-center gap-1 text-[11px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-100 hover:bg-primary-100">
                      <KeyRound size={10} /> {e.token}
                    </button>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${e.isPublished ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-gray-50 text-gray-400 border border-gray-200"}`}>
                      {e.isPublished ? <Eye size={10} /> : <EyeOff size={10} />} {e.isPublished ? "Terbit" : "Draft"}
                    </span>
                    {status === "BERLANGSUNG" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <PlayCircle size={10} /> Berlangsung
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{fmtDateTime(e.startTime)} — {fmtDateTime(e.endTime)} · {e.duration} menit</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{e._count.questions} soal</span>
                    <span className="ml-auto text-primary-600 font-semibold">{e._count.attempts} peserta</span>
                    <button onClick={() => handleDeleteExam(e.id, e.title)} className="p-1 text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
