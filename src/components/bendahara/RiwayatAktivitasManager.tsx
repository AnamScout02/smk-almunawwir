"use client";
import { useState, useEffect, useCallback } from "react";
import { History, Search, Loader2, FilePlus2, CheckCircle2, Layers, Pencil, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";

interface LogItem {
  id: string; userName: string; userRole: string; action: string;
  entity: string; entityId: string | null; description: string; createdAt: string;
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_INVOICE: "Buat Tagihan",
  MARK_INVOICE_PAID: "Catat Pembayaran",
  UPDATE_INVOICE: "Ubah Tagihan",
  DELETE_INVOICE: "Hapus Tagihan",
  GENERATE_INVOICES: "Generate Massal",
};

const ACTION_ICON: Record<string, LucideIcon> = {
  CREATE_INVOICE: FilePlus2, MARK_INVOICE_PAID: CheckCircle2,
  UPDATE_INVOICE: Pencil, DELETE_INVOICE: Trash2, GENERATE_INVOICES: Layers,
};

const ACTION_COLOR: Record<string, string> = {
  CREATE_INVOICE: "bg-blue-50 text-blue-700 border-blue-200",
  MARK_INVOICE_PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPDATE_INVOICE: "bg-amber-50 text-amber-700 border-amber-200",
  DELETE_INVOICE: "bg-red-50 text-red-700 border-red-200",
  GENERATE_INVOICES: "bg-purple-50 text-purple-700 border-purple-200",
};

/** Riwayat aktivitas KHUSUS modul Bendahara (portal `/dashboard/bendahara/riwayat`) — adaptasi
 * `LogAktivitasClient.tsx` (yang ADMIN-only & tampilkan semua log sistem), scoped ke
 * entity="Invoice" lewat `/api/bendahara/activity-log` — bukan reuse endpoint admin. */
export default function RiwayatAktivitasManager() {
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
    const res = await fetch(`/api/bendahara/activity-log?${params}`).catch(() => null);
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
      <PageHeader icon={<History size={22} />} title="Riwayat Aktivitas"
        description="Jejak aksi tagihan — buat, ubah, hapus, tandai lunas, generate massal" />

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
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
        <EmptyState icon={History} title="Belum ada riwayat aktivitas" description="Aksi tagihan yang tercatat akan muncul di sini." />
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
                    <p className="text-xs text-gray-400 mt-0.5">oleh {log.userName} ({log.userRole})</p>
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
