"use client";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Check, X, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface ChangeEntry { old: unknown; new: unknown; label: string }
interface EditRequest {
  id: string; status: string; createdAt: string; changes: Record<string, ChangeEntry>;
  student: { nis: string; user: { name: string }; class: { name: string } | null; major: { name: string } | null };
}

function displayVal(v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-gray-300 italic">kosong</span>;
  if (Array.isArray(v)) return `${v.length} item`;
  return String(v);
}

export default function VerifikasiDataPage() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [requests, setRequests] = useState<EditRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    fetch("/api/admin/profile-edit-requests?status=PENDING").then(r => r.json()).then(d => {
      setRequests(Array.isArray(d) ? d : []);
      setLoading(false);
    }).catch(() => { setLoading(false); });
  }
  useEffect(() => { load(); }, []);

  async function decide(id: string, action: "APPROVE" | "REJECT") {
    if (action === "REJECT" && !(await confirmDialog("Tolak pengajuan perubahan data ini?"))) return;
    setProcessingId(id);
    const res = await fetch(`/api/admin/profile-edit-requests/${id}/decide`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setProcessingId(null);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal memproses"); return; }
    load();
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<ShieldCheck size={22} />}
        title="Verifikasi Perubahan Data Siswa"
        description="Siswa mengajukan perubahan biodata sendiri — data resmi baru berubah setelah Anda setujui di sini"
      />

      {!loading && requests.length > 0 && (
        <div className="relative max-w-sm mb-5">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama atau NIS siswa..." className="input-field pl-9 text-sm" />
        </div>
      )}

      {(() => {
        const q = search.toLowerCase();
        const filteredRequests = requests.filter(req =>
          !q || req.student.user.name.toLowerCase().includes(q) || req.student.nis.toLowerCase().includes(q)
        );
        return loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : requests.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Tidak Ada Pengajuan Menunggu" description="Semua pengajuan perubahan data siswa sudah diproses." />
      ) : filteredRequests.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada pengajuan yang cocok dengan pencarian." />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(req => {
            const expanded = expandedId === req.id;
            const changeCount = Object.keys(req.changes).length;
            return (
              <div key={req.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <button onClick={() => setExpandedId(expanded ? null : req.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-primary-50/30 transition-colors">
                  <div>
                    <p className="font-semibold text-primary-900">{req.student.user.name} <span className="text-gray-400 font-normal text-sm">— NIS {req.student.nis}</span></p>
                    <p className="text-xs text-gray-400">{req.student.class?.name ?? "—"} · {req.student.major?.name ?? "—"} · {changeCount} field diubah · diajukan {new Date(req.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
                  </div>
                  <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">Menunggu</span>
                </button>
                {expanded && (
                  <div className="border-t border-gray-50 px-5 py-4">
                    <div className="overflow-x-auto mb-4">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 border-b border-gray-100">
                            <th className="py-2 pr-3">Field</th>
                            <th className="py-2 pr-3">Data Lama</th>
                            <th className="py-2 pr-3">Data Baru</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(req.changes).map(([key, c]) => (
                            <tr key={key} className="border-b border-gray-50 last:border-0">
                              <td className="py-2 pr-3 font-medium text-primary-900">{c.label}</td>
                              <td className="py-2 pr-3 text-gray-400">{displayVal(c.old)}</td>
                              <td className="py-2 pr-3 text-emerald-600 font-medium">{displayVal(c.new)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => decide(req.id, "REJECT")} disabled={processingId === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-semibold transition-colors">
                        <X size={14} /> Tolak
                      </button>
                      <button onClick={() => decide(req.id, "APPROVE")} disabled={processingId === req.id}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors">
                        {processingId === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Setujui
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
      })()}
    </div>
  );
}
