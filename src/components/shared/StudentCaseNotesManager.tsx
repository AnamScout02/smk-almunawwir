"use client";
import { useEffect, useState } from "react";
import { HeartHandshake, Plus, ClipboardList, Save, Loader2, Search, Trash2, CheckCircle2, Clock } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface StudentHit { id: string; nis: string; name: string; className: string }
interface CaseNote {
  id: string; handlingType: string; note: string; status: string; date: string;
  handledByName: string; handledByRole: string;
  student: { id: string; nis: string; user: { name: string }; class: { name: string } | null };
}

const HANDLING_TYPES = ["Konseling", "Panggilan Orang Tua", "Home Visit", "Mediasi", "Pembinaan", "Lainnya"];

/** Rekam BK / Penanganan Siswa — TERPISAH dari Poin Siswa (poin = angka, ini = catatan naratif
 * per kejadian penanganan). Akses PENUH khusus Admin/Wakasek Kesiswaan/Guru BK, sama seperti
 * StudentPointsManager tapi TANPA jalur guru piket sama sekali (isinya bisa sensitif). Dipakai
 * bareng portal admin & guru (pola komponen manager lintas portal, no.14 CLAUDE.md). */
export default function StudentCaseNotesManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<"catat" | "riwayat">("catat");

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<HeartHandshake size={22} />} title="Rekam BK — Penanganan Siswa"
        description="Catatan penanganan (konseling, panggilan orang tua, dll) — terpisah dari Poin Siswa" />

      <div className="flex gap-2 mb-6 flex-wrap">
        {([["catat", "Catat Penanganan", Plus], ["riwayat", "Riwayat", ClipboardList]] as const).map(([v, label, Icon]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === v ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "catat" && <CatatTab toast={toast} />}
      {tab === "riwayat" && <RiwayatTab toast={toast} confirmDialog={confirmDialog} />}
    </div>
  );
}

// ── Tab: Catat Penanganan ────────────────────────────────────────────────────
function CatatTab({ toast }: { toast: ReturnType<typeof useToast> }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [student, setStudent] = useState<StudentHit | null>(null);
  const [handlingType, setHandlingType] = useState(HANDLING_TYPES[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      fetch(`/api/admin/student-points/students-lookup?q=${encodeURIComponent(query)}`)
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setHits(d); })
        .catch(() => {}).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function handleSubmit() {
    if (!student) { toast.warning("Pilih siswa dulu."); return; }
    if (!note.trim()) { toast.warning("Isi catatan kronologi penanganan."); return; }
    setSaving(true);
    const res = await fetch("/api/admin/case-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, handlingType, note }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    toast.success(`Catatan penanganan tersimpan untuk ${student.name}.`);
    setStudent(null); setQuery(""); setNote(""); setHandlingType(HANDLING_TYPES[0]);
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 max-w-2xl space-y-5">
      <div>
        <label className="label-field">Siswa</label>
        {student ? (
          <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-4 py-2.5">
            <div><p className="font-semibold text-primary-900 text-sm">{student.name}</p><p className="text-xs text-gray-400">{student.nis} · {student.className}</p></div>
            <button onClick={() => { setStudent(null); setQuery(""); }} className="text-xs text-red-500 font-semibold">Ganti</button>
          </div>
        ) : (
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari nama atau NIS siswa..." className="input-field pl-10" />
            {searching && <Loader2 size={15} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />}
            {hits.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {hits.map(h => (
                  <button key={h.id} onClick={() => { setStudent(h); setHits([]); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0">
                    <p className="font-semibold text-sm text-primary-900">{h.name}</p>
                    <p className="text-xs text-gray-400">{h.nis} · {h.className}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label-field">Jenis Penanganan</label>
        <Select value={handlingType} onChange={setHandlingType} options={HANDLING_TYPES.map(t => ({ value: t, label: t }))} />
      </div>

      <div>
        <label className="label-field">Catatan / Kronologi (wajib)</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={5} className="input-field" placeholder="Kronologi kejadian, hasil konseling, tindak lanjut yang disepakati..." />
      </div>

      <button onClick={handleSubmit} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
        {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Simpan Catatan
      </button>
    </div>
  );
}

// ── Tab: Riwayat ─────────────────────────────────────────────────────────────
function RiwayatTab({ toast, confirmDialog }: { toast: ReturnType<typeof useToast>; confirmDialog: ReturnType<typeof useConfirm> }) {
  const [status, setStatus] = useState<"" | "BERJALAN" | "SELESAI">("");
  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    fetch(`/api/admin/case-notes?${params.toString()}`)
      .then(r => r.json()).then(d => setNotes(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleStatus(n: CaseNote) {
    const nextStatus = n.status === "BERJALAN" ? "SELESAI" : "BERJALAN";
    const res = await fetch(`/api/admin/case-notes/${n.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
    });
    if (!res.ok) { toast.error("Gagal mengubah status"); return; }
    load();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus catatan penanganan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    const res = await fetch(`/api/admin/case-notes/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    load();
  }

  return (
    <div>
      <div className="mb-4 w-56">
        <Select value={status} onChange={v => setStatus(v as "" | "BERJALAN" | "SELESAI")}
          options={[{ value: "", label: "Semua Status" }, { value: "BERJALAN", label: "Berjalan" }, { value: "SELESAI", label: "Selesai" }]} />
      </div>
      {loading ? (
        <div className="py-16 flex justify-center"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
      ) : notes.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="Belum Ada Catatan" description="Belum ada catatan penanganan siswa." />
      ) : (
        <div className="space-y-3">
          {notes.map(n => (
            <div key={n.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-primary-900">{n.student.user.name}</p>
                  <p className="text-xs text-gray-400 mb-2">{n.student.nis} · {n.student.class?.name ?? "—"}</p>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700">{n.handlingType}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${n.status === "SELESAI" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      {n.status === "SELESAI" ? <CheckCircle2 size={10} /> : <Clock size={10} />} {n.status === "SELESAI" ? "Selesai" : "Berjalan"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.note}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(n.date).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" })} · dicatat {n.handledByName}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleStatus(n)} className="text-xs font-semibold text-primary-600 hover:bg-primary-50 rounded-lg px-2.5 py-1.5 transition whitespace-nowrap">
                    Tandai {n.status === "BERJALAN" ? "Selesai" : "Berjalan"}
                  </button>
                  <button onClick={() => handleDelete(n.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
