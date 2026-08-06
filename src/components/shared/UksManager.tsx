"use client";
import { useEffect, useState } from "react";
import { HeartPulse, Loader2, Plus, Edit2, Trash2, Save, CalendarDays, Pill, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface StudentOption { id: string; nis: string; name: string; className: string }
interface MedicineUsage { quantity: number; medicine: { name: string; unit: string } }
interface Visit {
  id: string; visitDate: string; complaint: string; treatment: string | null; notes: string | null;
  student: { nis: string; user: { name: string }; class: { name: string } | null };
  usages: MedicineUsage[];
}
interface Medicine { id: string; name: string; stock: number; unit: string; notes: string | null }

const EMPTY_FORM = { studentId: "", visitDate: new Date().toISOString().slice(0, 10), complaint: "", treatment: "", notes: "" };
const EMPTY_MED_FORM = { name: "", stock: "0", unit: "pcs", notes: "" };
const TABS = [
  { key: "kunjungan", label: "Kunjungan" },
  { key: "obat", label: "Stok Obat" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function UksManager() {
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState<TabKey>("kunjungan");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Visit | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [usageRows, setUsageRows] = useState<{ medicineId: string; quantity: string }[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [medModal, setMedModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);
  const [medForm, setMedForm] = useState(EMPTY_MED_FORM);
  const [medError, setMedError] = useState("");
  const [savingMed, setSavingMed] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/uks/visits").then(r => r.json()),
      fetch("/api/uks/medicines").then(r => r.json()),
    ]).then(([v, m]) => {
      setVisits(Array.isArray(v) ? v : []);
      setMedicines(Array.isArray(m) ? m : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }
  useEffect(() => {
    load();
    fetch("/api/uks/students").then(r => r.json()).then(d => setStudents(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setUsageRows([]); setError(""); setModal(true); }
  function openEdit(v: Visit) {
    setEditing(v);
    setForm({ studentId: "", visitDate: v.visitDate.slice(0, 10), complaint: v.complaint, treatment: v.treatment ?? "", notes: v.notes ?? "" });
    setUsageRows([]);
    setError(""); setModal(true);
  }

  function addUsageRow() { setUsageRows(r => [...r, { medicineId: "", quantity: "1" }]); }
  function updateUsageRow(i: number, patch: Partial<{ medicineId: string; quantity: string }>) {
    setUsageRows(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }
  function removeUsageRow(i: number) { setUsageRows(r => r.filter((_, idx) => idx !== i)); }

  async function handleSave() {
    if (!editing && !form.studentId) { setError("Pilih siswa terlebih dahulu."); return; }
    if (!form.complaint.trim()) { setError("Keluhan wajib diisi."); return; }
    setSaving(true);
    const body = editing ? form : { ...form, medicineUsages: usageRows.filter(r => r.medicineId && Number(r.quantity) > 0) };
    const res = editing
      ? await fetch(`/api/uks/visits/${editing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/uks/visits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error || "Gagal menyimpan"); return; }
    setModal(false);
    load();
  }

  async function handleDelete(v: Visit) {
    if (!(await confirmDialog(`Hapus catatan kunjungan ${v.student.user.name}?`))) return;
    await fetch(`/api/uks/visits/${v.id}`, { method: "DELETE" });
    load();
  }

  function openAddMed() { setEditingMed(null); setMedForm(EMPTY_MED_FORM); setMedError(""); setMedModal(true); }
  function openEditMed(m: Medicine) {
    setEditingMed(m);
    setMedForm({ name: m.name, stock: String(m.stock), unit: m.unit, notes: m.notes ?? "" });
    setMedError(""); setMedModal(true);
  }
  async function handleSaveMed() {
    if (!medForm.name.trim()) { setMedError("Nama obat wajib diisi."); return; }
    setSavingMed(true);
    const res = editingMed
      ? await fetch(`/api/uks/medicines/${editingMed.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(medForm) })
      : await fetch("/api/uks/medicines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(medForm) });
    setSavingMed(false);
    if (!res.ok) { const d = await res.json(); setMedError(d.error || "Gagal menyimpan"); return; }
    setMedModal(false);
    load();
  }
  async function handleDeleteMed(m: Medicine) {
    if (!(await confirmDialog(`Hapus obat "${m.name}" dari stok?`))) return;
    await fetch(`/api/uks/medicines/${m.id}`, { method: "DELETE" });
    load();
  }

  const now = new Date();
  const thisMonth = visits.filter(v => {
    const d = new Date(v.visitDate);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const complaintCount = new Map<string, number>();
  for (const v of visits) complaintCount.set(v.complaint, (complaintCount.get(v.complaint) ?? 0) + 1);
  const topComplaint = Array.from(complaintCount.entries()).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="p-6 lg:p-8">
      <PageHeader
        icon={<HeartPulse size={22} />}
        title="UKS"
        description="Catatan kunjungan & stok obat Usaha Kesehatan Sekolah"
        actions={
          tab === "kunjungan" ? (
            <button onClick={openAdd} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
              <Plus size={15} /> Tambah Kunjungan
            </button>
          ) : (
            <button onClick={openAddMed} className="inline-flex items-center gap-2 bg-gold hover:bg-gold/90 text-primary-900 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
              <Plus size={15} /> Tambah Obat
            </button>
          )
        }
      />

      {!loading && tab === "kunjungan" && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          <StatTile color="primary" value={visits.length} label="Total Kunjungan" icon={HeartPulse} />
          <StatTile color="blue" value={thisMonth} label="Bulan Ini" icon={CalendarDays} />
          <StatTile color="amber" value={topComplaint ? topComplaint[1] : 0} label={topComplaint ? `Terbanyak: ${topComplaint[0]}` : "Belum Ada Data"} icon={HeartPulse} />
        </div>
      )}

      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageSkeleton />
      ) : tab === "kunjungan" ? (
        <>
          {visits.length === 0 ? (
            <EmptyState icon={HeartPulse} title="Belum Ada Kunjungan" description="Tambahkan catatan kunjungan siswa ke UKS." />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                      {["Siswa", "Kelas", "Tanggal", "Keluhan", "Tindakan", "Obat Terpakai", ""].map(h => (
                        <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visits.map(v => (
                      <tr key={v.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                        <td className="px-5 py-3.5">
                          <p className="font-semibold text-primary-900">{v.student.user.name}</p>
                          <p className="text-gray-400 text-xs font-mono">{v.student.nis}</p>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{v.student.class?.name ?? "—"}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{fmt(v.visitDate)}</td>
                        <td className="px-5 py-3.5 text-gray-600">{v.complaint}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">{v.treatment || "-"}</td>
                        <td className="px-5 py-3.5 text-gray-500 text-xs">
                          {v.usages.length > 0 ? v.usages.map((u, i) => (
                            <span key={i} className="inline-block bg-primary-50 text-primary-700 rounded-full px-2 py-0.5 mr-1 mb-0.5">{u.medicine.name} ×{u.quantity}{u.medicine.unit}</span>
                          )) : "-"}
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Ubah">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(v)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        medicines.length === 0 ? (
          <EmptyState icon={Pill} title="Belum Ada Data Obat" description="Tambahkan obat P3K ke stok UKS." />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    {["Nama Obat", "Stok", "Satuan", "Catatan", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {medicines.map(m => (
                    <tr key={m.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5 font-semibold text-primary-900">{m.name}</td>
                      <td className="px-5 py-3.5">
                        <span className={`font-bold ${m.stock <= 5 ? "text-red-500" : "text-emerald-600"}`}>{m.stock}</span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{m.unit}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{m.notes || "-"}</td>
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <button onClick={() => openEditMed(m)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-600 transition" title="Ubah">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => handleDeleteMed(m)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition" title="Hapus">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah Kunjungan" : "Tambah Kunjungan"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {error && <p className="error-msg mb-3">{error}</p>}
        <div className="space-y-3">
          {!editing && (
            <div>
              <label className="label-field">Siswa</label>
              <Select value={form.studentId} onChange={v => setForm(p => ({ ...p, studentId: v }))}
                options={students.map(s => ({ value: s.id, label: `${s.name} — ${s.className} (${s.nis})` }))} placeholder="— Pilih Siswa —" />
            </div>
          )}
          <div>
            <label className="label-field">Tanggal Kunjungan</label>
            <DatePicker value={form.visitDate} onChange={v => setForm(p => ({ ...p, visitDate: v }))} />
          </div>
          <div>
            <label className="label-field">Keluhan</label>
            <input value={form.complaint} onChange={e => setForm(p => ({ ...p, complaint: e.target.value }))} placeholder="cth: Demam" className="input-field" />
          </div>
          <div>
            <label className="label-field">Tindakan (opsional)</label>
            <input value={form.treatment} onChange={e => setForm(p => ({ ...p, treatment: e.target.value }))} placeholder="cth: Diberi obat penurun panas" className="input-field" />
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
          {!editing && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label-field mb-0">Obat Terpakai (opsional)</label>
                <button type="button" onClick={addUsageRow} className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1">
                  <Plus size={12} /> Tambah Obat
                </button>
              </div>
              <div className="space-y-2">
                {usageRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <Select value={row.medicineId} onChange={v => updateUsageRow(i, { medicineId: v })}
                        options={medicines.map(m => ({ value: m.id, label: `${m.name} (stok ${m.stock} ${m.unit})` }))} placeholder="— Pilih Obat —" />
                    </div>
                    <input type="number" min={1} value={row.quantity} onChange={e => updateUsageRow(i, { quantity: e.target.value })}
                      className="input-field w-20" />
                    <button type="button" onClick={() => removeUsageRow(i)} className="p-2 text-red-400 hover:text-red-600">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={medModal}
        onClose={() => setMedModal(false)}
        title={editingMed ? "Ubah Obat" : "Tambah Obat"}
        footer={
          <>
            <button type="button" onClick={() => setMedModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSaveMed} disabled={savingMed} className="btn-modal-save flex-1 flex items-center justify-center gap-2">
              {savingMed ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
            </button>
          </>
        }
      >
        {medError && <p className="error-msg mb-3">{medError}</p>}
        <div className="space-y-3">
          <div>
            <label className="label-field">Nama Obat</label>
            <input value={medForm.name} onChange={e => setMedForm(p => ({ ...p, name: e.target.value }))} placeholder="cth: Paracetamol" className="input-field" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Stok</label>
              <input type="number" min={0} value={medForm.stock} onChange={e => setMedForm(p => ({ ...p, stock: e.target.value }))} className="input-field" />
            </div>
            <div>
              <label className="label-field">Satuan</label>
              <input value={medForm.unit} onChange={e => setMedForm(p => ({ ...p, unit: e.target.value }))} placeholder="tablet/strip/botol" className="input-field" />
            </div>
          </div>
          <div>
            <label className="label-field">Catatan (opsional)</label>
            <textarea value={medForm.notes} onChange={e => setMedForm(p => ({ ...p, notes: e.target.value }))} rows={2} className="input-field resize-none" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
