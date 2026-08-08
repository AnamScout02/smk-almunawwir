"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileCheck, Loader2, CheckCircle2, Clock, Lock, Unlock } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import GroupedSection from "@/components/admin/GroupedSection";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface Row {
  classId: string; className: string; grade: number; semester: string;
  approved: boolean; approvalId: string | null; approvedBy: string | null; approvedAt: string | null;
}

const GRADE_LABEL: Record<number, string> = { 10: "Kelas X", 11: "Kelas XI", 12: "Kelas XII" };

export default function PengesahanRaporPage() {
  const confirmDialog = useConfirm();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/teacher/kepala-sekolah/rapor-approvals").then(r => r.json()).then(d => {
      setRows(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function approve(row: Row) {
    setBusyKey(`${row.classId}::${row.semester}`);
    try {
      await fetch("/api/teacher/kepala-sekolah/rapor-approvals", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: row.classId, semester: row.semester }),
      });
      load();
    } catch {
      // biarkan tombol reset di finally, biar bisa dicoba lagi
    } finally {
      setBusyKey(null);
    }
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
  const grades = [...new Set(rows.map(r => r.grade))].sort((a, b) => a - b);

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<FileCheck size={22} />}
        title="Pengesahan Rapor"
        description="Rapor siswa hanya bisa dilihat/dicetak setelah kelas & semesternya disahkan di sini"
      />

      <div className="flex justify-end mb-5">
        <Link href="/dashboard/teacher/kepala-sekolah" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition">
          <ArrowLeft size={18} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={22} className="animate-spin mr-2" /> Memuat data...
        </div>
      ) : (
        <div className="space-y-6">
          {grades.map(grade => (
            <GroupedSection key={grade} title={GRADE_LABEL[grade] ?? `Tingkat ${grade}`} count={rows.filter(r => r.grade === grade).length} icon={FileCheck}>
              <div className="divide-y divide-gray-50">
                {rows.filter(r => r.grade === grade).map(row => {
                  const key = `${row.classId}::${row.semester}`;
                  const busy = busyKey === key;
                  return (
                    <div key={key} className="flex items-center gap-3 px-5 py-3.5">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-primary-900 text-sm">{row.className}</p>
                        <p className="text-xs text-gray-400">{row.semester}</p>
                      </div>
                      {row.approved ? (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Disahkan {row.approvedAt && fmt(row.approvedAt)}
                        </span>
                      ) : (
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Clock size={11} /> Belum Disahkan
                        </span>
                      )}
                      {row.approved ? (
                        <button onClick={() => unapprove(row)} disabled={busy}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-red-50 border border-red-100 transition-colors shrink-0">
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <Lock size={12} />} Batalkan
                        </button>
                      ) : (
                        <button onClick={() => approve(row)} disabled={busy}
                          className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-800 font-semibold px-2.5 py-1.5 rounded-lg hover:bg-emerald-50 border border-emerald-100 transition-colors shrink-0">
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
