"use client";
import React, { useState, useEffect, useCallback } from "react";
import { History, Search, Loader2, KeyRound, UserCog, UserPlus, UserX, Award, ClipboardCheck, Trash2, BookOpen, DatabaseZap } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";

interface LogItem {
  id: string; userName: string; userRole: string; action: string;
  entity: string; entityId: string | null; description: string; createdAt: string;
  /** Admin asli kalau aksi ini dilakukan lewat "Masuk Sebagai". */
  impersonatorName?: string | null;
}

const ACTION_LABEL: Record<string, string> = {
  CHANGE_OWN_PASSWORD: "Ganti Password Sendiri",
  RESET_PASSWORD: "Reset Password",
  CABUT_SESI: "Cabut Sesi Login",
  UBAH_KEBIJAKAN_SESI: "Ubah Kebijakan Sesi",
  CREATE_USER: "Buat Akun",
  UPDATE_USER: "Ubah Akun",
  DELETE_USER: "Hapus Akun",
  UPDATE_JABATAN: "Ubah Jabatan",
  UPDATE_STUDENT_NAME: "Ubah Nama Siswa",
  DELETE_STUDENT: "Hapus Siswa",
  DECIDE_ADMISSION: "Keputusan SPMB",
  DELETE_ADMISSION: "Hapus Pendaftar",
  UPDATE_BUKU_INDUK: "Ubah Buku Induk",
  TES_DAPODIK: "Tes Koneksi Dapodik",
  EKSPOR_DAPODIK: "Unduh Daftar Dapodik",
};

const ACTION_ICON: Record<string, React.ElementType> = {
  CHANGE_OWN_PASSWORD: KeyRound, RESET_PASSWORD: KeyRound,
  CREATE_USER: UserPlus, UPDATE_USER: UserCog, DELETE_USER: UserX,
  UPDATE_JABATAN: Award, UPDATE_STUDENT_NAME: UserCog,
  DELETE_STUDENT: Trash2, DECIDE_ADMISSION: ClipboardCheck, DELETE_ADMISSION: Trash2,
  UPDATE_BUKU_INDUK: BookOpen,
  TES_DAPODIK: DatabaseZap, EKSPOR_DAPODIK: DatabaseZap,
};

const ACTION_COLOR: Record<string, string> = {
  CHANGE_OWN_PASSWORD: "bg-blue-50 text-blue-700 border-blue-200",
  RESET_PASSWORD: "bg-blue-50 text-blue-700 border-blue-200",
  CREATE_USER: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE_USER: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE_USER: "bg-red-50 text-red-700 border-red-200",
  UPDATE_JABATAN: "bg-purple-50 text-purple-700 border-purple-200",
  UPDATE_STUDENT_NAME: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE_STUDENT: "bg-red-50 text-red-700 border-red-200",
  DECIDE_ADMISSION: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DELETE_ADMISSION: "bg-red-50 text-red-700 border-red-200",
  UPDATE_BUKU_INDUK: "bg-amber-50 text-amber-700 border-amber-200",
  TES_DAPODIK: "bg-blue-50 text-blue-700 border-blue-200",
  EKSPOR_DAPODIK: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function LogAktivitasClient() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 50;

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (q) params.set("q", q);
    if (action) params.set("action", action);
    const res = await fetch(`/api/admin/activity-log?${params}`).catch(() => null);
    const data = await res?.json();
    setLogs(data.logs ?? []);
    setTotal(data.total ?? 0);
    setActions(data.actions ?? []);
    setLoading(false);
  }, [page, q, action]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [q, action]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "baru saja";
    if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} hari lalu`;
    return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<History size={22} />}
        title="Log Aktivitas"
        description="Jejak aksi sensitif: reset password, ubah jabatan, hapus akun, keputusan SPMB, dll — khusus Administrator"
      />

      <div className="baris-alat mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={q} onChange={e => setQ(e.target.value)}
            placeholder="Cari nama pelaku atau deskripsi..."
            className="input-field pl-10"
          />
        </div>
        <div className="w-full sm:w-64">
          <Select
            value={action} onChange={setAction}
            options={[{ value: "", label: "Semua jenis aksi" }, ...actions.map(a => ({ value: a, label: ACTION_LABEL[a] ?? a }))]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" size={28} /></div>
      ) : logs.length === 0 ? (
        <EmptyState icon={History} title="Belum ada log aktivitas" description="Aksi sensitif yang tercatat akan muncul di sini." />
      ) : (
        <>
          <div className="panel divide-y divide-gray-50 overflow-hidden">
            {logs.map(log => {
              const Icon = ACTION_ICON[log.action] ?? History;
              return (
                <div key={log.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${ACTION_COLOR[log.action] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`inline-flex text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${ACTION_COLOR[log.action] ?? "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {ACTION_LABEL[log.action] ?? log.action}
                      </span>
                      <span className="text-xs text-gray-400 shrink-0">{timeAgo(log.createdAt)}</span>
                    </div>
                    <p className="text-sm text-navy mt-1.5 leading-snug">{log.description}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      oleh {log.userName} ({log.userRole})
                      {log.impersonatorName && (
                        <span className="text-amber-700 font-semibold"> · dilakukan {log.impersonatorName} lewat Masuk Sebagai</span>
                      )}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <p className="text-gray-400">Halaman {page} dari {totalPages} · {total} total log</p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
                  Sebelumnya
                </button>
                <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50">
                  Berikutnya
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
