"use client";
import { useEffect, useState } from "react";
import { FileCheck2, Loader2, CheckCircle2, XCircle, Clock, FileText, Settings, Plus, Trash2, Eye, Search } from "lucide-react";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface Doc { requirementId: string; fileUrl: string; requirement: { name: string } }
interface Registration {
  id: string; status: string; submittedAt: string; reviewNote: string | null;
  student: { nis: string; user: { name: string }; class: { name: string } | null; major: { name: string } };
  documents: Doc[];
}
interface Requirement { id: string; name: string; order: number; active: boolean }

const STATUS_META: Record<string, { label: string; badge: string; icon: typeof Clock }> = {
  PENDING: { label: "Menunggu", badge: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock },
  APPROVED: { label: "Disetujui", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle2 },
  REJECTED: { label: "Ditolak", badge: "bg-red-50 text-red-600 border-red-200", icon: XCircle },
};

/** Review pendaftaran PKL + kelola daftar dokumen syarat — dipakai Admin & guru Wakil Kepala
 * Humas (pola *Manager komponen shared, lihat NewsManager/GalleryManager). */
export default function PklRegistrationReview() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState<"pendaftaran" | "syarat">("pendaftaran");
  const [statusFilter, setStatusFilter] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [list, setList] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Registration | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [deciding, setDeciding] = useState(false);

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [newReqName, setNewReqName] = useState("");
  const [reqLoading, setReqLoading] = useState(true);

  function loadList() {
    setLoading(true);
    fetch(`/api/teacher/humas/pkl-registrations?status=${statusFilter}`)
      .then(r => r.json()).then(d => setList(Array.isArray(d) ? d : []))
      .catch(() => setList([])).finally(() => setLoading(false));
  }
  function loadRequirements() {
    setReqLoading(true);
    fetch("/api/admin/pkl-requirements").then(r => r.json()).then(d => setRequirements(Array.isArray(d) ? d : []))
      .catch(() => setRequirements([])).finally(() => setReqLoading(false));
  }
  useEffect(() => { loadList(); }, [statusFilter]);
  useEffect(() => { loadRequirements(); }, []);

  async function decide(id: string, decision: "APPROVED" | "REJECTED") {
    setDeciding(true);
    const res = await fetch(`/api/teacher/humas/pkl-registrations/${id}/decide`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, reviewNote: reviewNote || undefined }),
    });
    setDeciding(false);
    if (res.ok) {
      toast.success(decision === "APPROVED" ? "Pendaftaran disetujui" : "Pendaftaran ditolak");
      setDetail(null); setReviewNote(""); loadList();
    } else {
      const d = await res.json().catch(() => ({}));
      toast.error(d.error || "Gagal memproses");
    }
  }

  async function addRequirement() {
    if (!newReqName.trim()) return;
    const res = await fetch("/api/admin/pkl-requirements", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newReqName.trim() }),
    });
    if (res.ok) { setNewReqName(""); loadRequirements(); toast.success("Dokumen syarat ditambahkan"); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || "Gagal menambah"); }
  }
  async function toggleRequirement(r: Requirement) {
    await fetch(`/api/admin/pkl-requirements/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    });
    loadRequirements();
  }
  async function deleteRequirement(r: Requirement) {
    if (!await confirmDialog(`Hapus syarat dokumen "${r.name}"?`)) return;
    await fetch(`/api/admin/pkl-requirements/${r.id}`, { method: "DELETE" });
    loadRequirements();
  }

  return (
    <div>
      <div className="flex items-center gap-1 mb-5 rounded-xl border border-gray-100 p-1 w-max bg-white shadow-sm">
        <button onClick={() => setTab("pendaftaran")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${tab === "pendaftaran" ? "bg-primary-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <FileCheck2 size={14} /> Pendaftaran PKL
        </button>
        <button onClick={() => setTab("syarat")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${tab === "syarat" ? "bg-primary-800 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
          <Settings size={14} /> Dokumen Syarat
        </button>
      </div>

      {tab === "pendaftaran" ? (
        <>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {["PENDING", "APPROVED", "REJECTED"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${statusFilter === s ? "bg-primary-800 text-white border-primary-800" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
                {STATUS_META[s].label}
              </button>
            ))}
            <div className="relative flex-1 min-w-48 ml-auto">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama atau NIS siswa..." className="input-field pl-9 text-sm" />
            </div>
          </div>
          {(() => {
            const filtered = list.filter(reg => {
              const q = search.toLowerCase();
              return !q || reg.student.user.name.toLowerCase().includes(q) || reg.student.nis.toLowerCase().includes(q);
            });
            return loading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-400" size={28} /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={FileCheck2} title="Tidak Ada Pendaftaran" description={search ? "Tidak ada yang cocok dengan pencarian." : `Belum ada pendaftaran PKL berstatus ${STATUS_META[statusFilter].label.toLowerCase()}.`} />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="divide-y divide-gray-50">
                {filtered.map(reg => (
                  <div key={reg.id} className="px-5 py-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-primary-900">{reg.student.user.name}</p>
                      <p className="text-xs text-gray-400">{reg.student.nis} · {reg.student.class?.name ?? "-"} · {reg.student.major.name}</p>
                    </div>
                    <button onClick={() => { setDetail(reg); setReviewNote(""); }}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 border border-primary-100 font-semibold transition-colors">
                      <Eye size={13} /> Lihat Detail
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
          })()}
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 max-w-xl">
          <p className="text-xs text-gray-400 mb-4">Daftar dokumen yang wajib diunggah siswa kelas XI saat mendaftar PKL. Nonaktifkan (bukan hapus) kalau dokumen tidak lagi dipakai tapi datanya masih ingin disimpan.</p>
          <div className="flex gap-2 mb-4">
            <input value={newReqName} onChange={e => setNewReqName(e.target.value)} placeholder="Nama dokumen baru (mis. Surat Izin Orang Tua)"
              className="input-field flex-1" onKeyDown={e => e.key === "Enter" && addRequirement()} />
            <button onClick={addRequirement} className="btn-gold flex items-center gap-1.5 text-sm shrink-0"><Plus size={14} /> Tambah</button>
          </div>
          {reqLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-gray-300" /></div>
          ) : requirements.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Belum ada dokumen syarat.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {requirements.map(r => (
                <div key={r.id} className="py-2.5 flex items-center gap-3">
                  <FileText size={14} className="text-gray-300 shrink-0" />
                  <span className={`flex-1 text-sm ${r.active ? "text-primary-900" : "text-gray-400 line-through"}`}>{r.name}</span>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={r.active} onChange={() => toggleRequirement(r)} /> Aktif
                  </label>
                  <button onClick={() => deleteRequirement(r)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={detail ? `Pendaftaran PKL — ${detail.student.user.name}` : ""}
        footer={detail?.status === "PENDING" ? (
          <>
            <button type="button" onClick={() => decide(detail.id, "REJECTED")} disabled={deciding}
              className="btn-modal-cancel flex-1 flex items-center justify-center gap-2 text-red-600"><XCircle size={14} /> Tolak</button>
            <button type="button" onClick={() => decide(detail.id, "APPROVED")} disabled={deciding}
              className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {deciding ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Setujui
            </button>
          </>
        ) : undefined}>
        {detail && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500">
              {detail.student.nis} · {detail.student.class?.name ?? "-"} · {detail.student.major.name}
            </div>
            <div className="space-y-2">
              <p className="label-field">Dokumen Diunggah</p>
              {detail.documents.map(doc => (
                <a key={doc.requirementId} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-gray-50 text-sm text-primary-700">
                  <FileText size={14} /> {doc.requirement.name}
                </a>
              ))}
            </div>
            {detail.status === "PENDING" && (
              <div>
                <label className="label-field">Catatan (wajib kalau menolak)</label>
                <textarea className="input-field resize-none" rows={2} value={reviewNote} onChange={e => setReviewNote(e.target.value)}
                  placeholder="Jelaskan kalau menolak, mis. dokumen kurang jelas..." />
              </div>
            )}
            {detail.reviewNote && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{detail.reviewNote}</p>}
          </div>
        )}
      </Modal>
    </div>
  );
}
