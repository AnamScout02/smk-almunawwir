"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck, Loader2, CheckCircle2, Clock, Lock, Printer, Unlock } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import GroupedSection from "@/components/admin/GroupedSection";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import Select from "@/components/admin/Select";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import TombolKembali from "@/components/shared/TombolKembali";

interface Row {
  classId: string; className: string; grade: number; semester: string;
  approved: boolean; approvalId: string | null; approvedBy: string | null; approvedAt: string | null;
  waliKelas: string | null; locked: boolean; lockedBy: string | null; lockedAt: string | null;
}

const GRADE_LABEL: Record<number, string> = { 10: "Kelas X", 11: "Kelas XI", 12: "Kelas XII" };

/** Dipakai portal GURU (pemegang tugasnya) dan portal ADMIN (superadmin — akses penuh tanpa
 * dilempar ke shell portal guru, keputusan user 19 September 2026). */
/** `cetakHref` = halaman cetak rapor portal pemakai (guru: /dashboard/teacher/rapor-kelas/cetak, admin: /dashboard/admin/rapor-cetak) —
 * Kepala Sekolah memeriksa lembar rapor sebelum mengesahkan. */
export default function PengesahanRapor({ basePath = BASE_GURU, cetakHref = tautanJabatan(basePath, "rapor-kelas/cetak"), kembaliHref = tautanJabatan(basePath, "kepala-sekolah"), dariPengesahan = true }: {
  basePath?: string; cetakHref?: string; kembaliHref?: string; dariPengesahan?: boolean;
} = {}) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [semester, setSemester] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/teacher/kepala-sekolah/rapor-approvals", { cache: "no-store" }).then(r => r.json()).then(d => {
      const daftar: Row[] = Array.isArray(d) ? d : [];
      setRows(daftar);
      const sems = [...new Set(daftar.map(r => r.semester))];
      setSemester(s => s || sems[2] || sems[0] || "");
    }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function approve(row: Row) {
    setBusyKey(`${row.classId}::${row.semester}`);
    try {
      const r = await fetch("/api/teacher/kepala-sekolah/rapor-approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: row.classId, semester: row.semester }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok) toast.error(d?.error ?? "Gagal mengesahkan.");
      else toast.success(`Rapor ${row.className} disahkan.`);
      load();
    } catch {
      // biarkan tombol reset di finally, biar bisa dicoba lagi
    } finally {
      setBusyKey(null);
    }
  }

  async function sahkanSemua() {
    const siap = tampil.filter(r => r.locked && !r.approved);
    if (!siap.length) return;
    if (!(await confirmDialog(`Sahkan rapor ${siap.length} kelas yang sudah dikunci wali kelas (${semester})? Siswa & orang tua langsung bisa melihat dan mencetak rapornya.`))) return;
    setBusyKey("semua");
    const r = await fetch("/api/teacher/kepala-sekolah/rapor-approvals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classIds: siap.map(x => x.classId), semester }),
    }).catch(() => null);
    const d = await r?.json().catch(() => null);
    setBusyKey(null);
    if (!r?.ok) { toast.error(d?.error ?? "Gagal mengesahkan."); return; }
    toast.success(`${d?.disahkan ?? siap.length} kelas disahkan.`);
    load();
  }

  async function unapprove(row: Row) {
    if (!row.approvalId) return;
    if (!(await confirmDialog(`Batalkan pengesahan rapor ${row.className} — ${row.semester}? Siswa tidak akan bisa lihat rapor semester ini lagi.`))) return;
    setBusyKey(`${row.classId}::${row.semester}`);
    try {
      await fetch(`/api/teacher/kepala-sekolah/rapor-approvals/${row.approvalId}`, { method: "DELETE" });
      load();
    } catch {
      // biarkan tombol reset di finally, biar bisa dicoba lagi
    } finally {
      setBusyKey(null);
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const semesters = [...new Set(rows.map(r => r.semester))];
  const tampil = rows.filter(r => r.semester === semester);
  const grades = [...new Set(tampil.map(r => r.grade))].sort((a, b) => a - b);
  const siapSah = tampil.filter(r => r.locked && !r.approved).length;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<FileCheck size={22} />}
        title="Pengesahan Rapor"
        description="Rapor siswa hanya bisa dilihat/dicetak setelah kelas & semesternya disahkan di sini"
      />

      <div className="baris-alat mb-5">
        <div className="alat-saring">
          <Select value={semester} onChange={setSemester} options={semesters.map(s => ({ value: s, label: s }))} />
        </div>
        <p className="alat-saring text-sm text-gray-600">
          {siapSah > 0 ? <><strong className="text-primary-900">{siapSah} kelas</strong> sudah dikunci wali kelas dan menunggu pengesahan.</> : "Tidak ada kelas yang menunggu pengesahan."}
        </p>
        <div className="alat-aksi">
          <button type="button" onClick={sahkanSemua} disabled={!siapSah || busyKey === "semua"} className="btn-modal-save">
            {busyKey === "semua" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Sahkan Semua yang Siap ({siapSah})
          </button>
          <TombolKembali href={kembaliHref} />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : (
        <div className="space-y-6">
          {grades.map(grade => (
            <GroupedSection key={grade} title={GRADE_LABEL[grade] ?? `Tingkat ${grade}`} count={tampil.filter(r => r.grade === grade).length} icon={FileCheck}>
              <div className="divide-y divide-gray-50">
                {tampil.filter(r => r.grade === grade).map(row => {
                  const key = `${row.classId}::${row.semester}`;
                  const busy = busyKey === key;
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 sm:px-5 py-3.5">
                      {/* HP: nama kelas & wali selebar baris, status + tombol di bawahnya (dulu terjepit sampai 2px). */}
                      <div className="min-w-0 flex-1 basis-full sm:basis-0">
                        <p className="font-semibold text-primary-900 text-sm">{row.className}</p>
                        <p className="text-xs text-gray-500">
                          Wali kelas: {row.waliKelas ?? "—"}{row.locked && row.lockedAt ? ` · dikunci ${fmt(row.lockedAt)}` : ""}
                        </p>
                      </div>
                      <Link title="Lihat & cetak rapor kelas ini"
                        href={`${cetakHref}?${new URLSearchParams({ classId: row.classId, semester: row.semester, ...(dariPengesahan ? { dari: "pengesahan" } : {}) }).toString()}`}
                        className="btn-modal-cancel px-3 text-xs"><Printer size={14} /> Lihat Rapor</Link>
                      {row.approved ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle2 size={11} /> Disahkan {row.approvedAt && fmt(row.approvedAt)}
                        </span>
                      ) : row.locked ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 whitespace-nowrap">
                          <Lock size={11} /> Siap disahkan
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 whitespace-nowrap">
                          <Clock size={11} /> Belum dikunci wali kelas
                        </span>
                      )}
                      {row.approved ? (
                        <button onClick={() => unapprove(row)} disabled={busy}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100 transition-colors shrink-0">
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />} Batalkan
                        </button>
                      ) : (
                        <button onClick={() => approve(row)} disabled={busy || !row.locked} title={row.locked ? "Sahkan rapor" : "Menunggu wali kelas mengunci nilai"}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 border border-emerald-100 transition-colors shrink-0 disabled:cursor-not-allowed disabled:opacity-40">
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Unlock size={12} />} Sahkan
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </GroupedSection>
          ))}
        </div>
      )}
    </div>
  );
}
