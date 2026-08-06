"use client";
import { useEffect, useState } from "react";
import { UserCheck, Loader2, Edit2 } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface Tracer {
  status: string; institutionName: string | null; position: string | null;
  contactPhone: string | null; contactEmail: string | null; surveyDate: string; notes: string | null;
}
interface Alumni {
  id: string; nis: string; enrollYear: number | null;
  user: { name: string }; major: { name: string; code: string };
  alumniTracer: Tracer | null;
}

const STATUS_OPTIONS = [
  { value: "BEKERJA", label: "Bekerja" },
  { value: "KULIAH", label: "Kuliah" },
  { value: "WIRAUSAHA", label: "Wirausaha" },
  { value: "BELUM_BEKERJA", label: "Belum Bekerja" },
  { value: "LAINNYA", label: "Lainnya" },
];
const STATUS_BADGE: Record<string, string> = {
  BEKERJA: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  KULIAH: "bg-blue-50 text-blue-600 border border-blue-200",
  WIRAUSAHA: "bg-purple-50 text-purple-600 border border-purple-200",
  BELUM_BEKERJA: "bg-red-50 text-red-500 border border-red-200",
  LAINNYA: "bg-gray-50 text-gray-500 border border-gray-200",
};

const EMPTY_FORM = { status: "BEKERJA", institutionName: "", position: "", contactPhone: "", contactEmail: "", surveyDate: "", notes: "" };

export default function TracerStudyManager() {
  const [items, setItems] = useState<Alumni[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Alumni | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/tracer-study").then(r => r.json()).then(d => { setItems(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  function openEdit(item: Alumni) {
    setEditing(item);
    const t = item.alumniTracer;
    setForm({
      status: t?.status ?? "BEKERJA", institutionName: t?.institutionName ?? "", position: t?.position ?? "",
      contactPhone: t?.contactPhone ?? "", contactEmail: t?.contactEmail ?? "",
      surveyDate: t?.surveyDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      notes: t?.notes ?? "",
    });
    setError(""); setModal(true);
  }

  async function handleSave() {
    if (!editing) return;
    if (!form.surveyDate) { setError("Tanggal survei wajib diisi."); return; }
    setSaving(true);
    const res = await fetch(`/api/tracer-study/${editing.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  const withData = items.filter(i => i.alumniTracer).length;

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<UserCheck size={22} />}
        title="Tracer Study Alumni"
        description={`Pelacakan lulusan — ${withData}/${items.length} sudah disurvei`}
      />

      {loading ? (
        <PageSkeleton />
      ) : items.length === 0 ? (
        <EmptyState icon={UserCheck} title="Belum Ada Alumni" description="Belum ada siswa berstatus Lulus." />
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  {["Alumni", "Jurusan", "Angkatan", "Status", "Institusi/Perusahaan", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-primary-900">{item.user.name}</p>
                      <p className="text-gray-400 text-xs font-mono">{item.nis}</p>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{item.major.code}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{item.enrollYear ?? "—"}</td>
                    <td className="px-5 py-3.5">
                      {item.alumniTracer ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_BADGE[item.alumniTracer.status] ?? STATUS_BADGE.LAINNYA}`}>
                          {STATUS_OPTIONS.find(s => s.value === item.alumniTracer!.status)?.label ?? item.alumniTracer.status}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-200 whitespace-nowrap">Belum Disurvei</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{item.alumniTracer?.institutionName || "-"}</td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Isi/Ubah">
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? `Data Tracer — ${editing.user.name}` : "Data Tracer"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : null} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field">Status Saat Ini</label>
            <Select value={form.status} onChange={v => setForm(p => ({ ...p, status: v }))} options={STATUS_OPTIONS} />
          </div>
          <div>
            <label className="label-field">Nama Perusahaan/Kampus</label>
            <input value={form.institutionName} onChange={e => setForm(p => ({ ...p, institutionName: e.target.value }))} className="input-field" />
          </div>
          <div>
            <label className="label-field">Jabatan/Jurusan Kuliah</label>
            <input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">No. HP</label>
              <input value={form.contactPhone} onChange={e => setForm(p => ({ ...p, contactPhone: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input value={form.contactEmail} onChange={e => setForm(p => ({ ...p, contactEmail: e.target.value }))} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Tanggal Survei</label>
            <DatePicker value={form.surveyDate} onChange={v => setForm(p => ({ ...p, surveyDate: v }))} />
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
