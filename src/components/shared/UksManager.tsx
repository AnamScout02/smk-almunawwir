"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { HeartPulse, Loader2, Plus, Edit2, Trash2, Save, CalendarDays, Pill, X, Search, ScanLine, Ruler, FileSpreadsheet } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { PageSkeleton } from "@/components/shared/Skeleton";

interface StudentOption { id: string; nis: string; name: string; className: string }
interface MedicineUsage { quantity: number; medicine: { name: string; unit: string } }
interface Visit {
  id: string; visitDate: string; complaint: string; treatment: string | null; notes: string | null; rujukan?: string | null;
  student: { nis: string; user: { name: string }; class: { name: string } | null };
  usages: MedicineUsage[];
}
interface Medicine { id: string; name: string; stock: number; unit: string; notes: string | null; kedaluwarsa: string | null; stokMinimum: number }

const EMPTY_FORM = { studentId: "", visitDate: new Date().toISOString().slice(0, 10), complaint: "", treatment: "", notes: "", rujukan: "", kabarOrtu: false };
const EMPTY_MED_FORM = { name: "", stock: "0", unit: "pcs", notes: "", kedaluwarsa: "", stokMinimum: "5" };
const TABS = [
  { key: "kunjungan", label: "Kunjungan" },
  { key: "obat", label: "Stok Obat" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function fmt(d: string) {
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function UksManager({ base = "/dashboard/teacher/uks" }: { base?: string }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
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
  const [search, setSearch] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/uks/visits").then(r => r.json()).catch(() => {}),
      fetch("/api/uks/medicines").then(r => r.json()).catch(() => {}),
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

  // Scan Kartu Tanda — identifier SAMA PERSIS dgn yg dipakai Perpustakaan/Piket (NIS siswa), jadi
  // kartu yg sama tinggal di-scan di sini juga. Beda dari Perpustakaan/Piket yg langsung
  // auto-simpan, di sini scan cuma BUKA & isi form "Tambah Kunjungan" dgn siswa terpilih (bukan
  // auto-submit) — karena UksVisit.complaint wajib diisi, petugas tetap perlu ketik keluhannya.
  const [scanInput, setScanInput] = useState("");
  function handleScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const code = scanInput.trim();
    setScanInput("");
    if (!code) return;
    const student = students.find(s => s.nis === code);
    if (!student) { toast.error(`Kartu "${code}" tidak dikenali.`); return; }
    setEditing(null);
    setForm({ ...EMPTY_FORM, studentId: student.id });
    setUsageRows([]);
    setError("");
    setModal(true);
    toast.success(`${student.name} — lengkapi keluhan lalu simpan.`);
  }
  function openEdit(v: Visit) {
    setEditing(v);
    setForm({ studentId: "", visitDate: v.visitDate.slice(0, 10), complaint: v.complaint, treatment: v.treatment ?? "", notes: v.notes ?? "", rujukan: v.rujukan ?? "", kabarOrtu: false });
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
    setMedForm({ name: m.name, stock: String(m.stock), unit: m.unit, notes: m.notes ?? "", kedaluwarsa: m.kedaluwarsa ? new Date(new Date(m.kedaluwarsa).getTime() + 7 * 3600_000).toISOString().slice(0, 10) : "", stokMinimum: String(m.stokMinimum ?? 5) });
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

  const q = search.toLowerCase();
  const filteredVisits = visits.filter(v =>
    !q || v.student.user.name.toLowerCase().includes(q) || v.student.nis.toLowerCase().includes(q) || v.complaint.toLowerCase().includes(q)
  );
  const filteredMedicines = medicines.filter(m => !q || m.name.toLowerCase().includes(q));

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<HeartPulse size={22} />}
        title="UKS"
        description="Catatan kunjungan & stok obat Usaha Kesehatan Sekolah"
      />

      {!loading && (() => {
        const batas = Date.now() + 30 * 86400000;
        const hampir = medicines.filter(m => m.kedaluwarsa && new Date(m.kedaluwarsa).getTime() <= batas);
        const menipis = medicines.filter(m => m.stock <= (m.stokMinimum ?? 5));
        if (!hampir.length && !menipis.length) return null;
        return (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {hampir.length > 0 && <p><strong>Kedaluwarsa ≤30 hari / lewat:</strong> {hampir.map(m => m.name).join(", ")}</p>}
            {menipis.length > 0 && <p><strong>Stok menipis:</strong> {menipis.map(m => `${m.name} (${m.stock})`).join(", ")}</p>}
          </div>
        );
      })()}

      {tab === "kunjungan" && (
        <div className="flex items-center gap-2 bg-primary-50/60 border border-primary-100 rounded-xl px-3 py-2.5 mb-4">
          <ScanLine size={16} className="text-primary-700 shrink-0" />
          <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={handleScan}
            placeholder="Pindai Kartu Tanda siswa lalu Enter — formulir kunjungan terbuka otomatis"
            className="min-w-0 flex-1 bg-transparent border-0 outline-none text-base sm:text-sm placeholder:text-gray-400" />
        </div>
      )}

      {!loading && tab === "kunjungan" && (
        <div className="kisi-kartu kisi-kartu-3 mb-5">
          <StatTile color="primary" value={visits.length} label="Total Kunjungan" icon={HeartPulse} />
          <StatTile color="blue" value={thisMonth} label="Bulan Ini" icon={CalendarDays} />
          <StatTile color="amber" value={topComplaint ? topComplaint[1] : 0} label={topComplaint ? `Terbanyak: ${topComplaint[0]}` : "Belum Ada Data"} icon={HeartPulse} />
        </div>
      )}

      <div className="alat-aksi justify-end mb-5">
        <Link href={`${base}/pemeriksaan`} className="btn-modal-cancel btn-teks"><Ruler size={15} /> Pemeriksaan TB/BB</Link>
        <a href={`/api/uks/laporan?bulan=${new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7)}`} className="btn-modal-cancel btn-teks"><FileSpreadsheet size={15} /> Laporan Bulan Ini</a>
      </div>

      <div className="baris-alat mb-5">
        <div className="alat-tab flex flex-wrap gap-1 border border-gray-100 bg-white rounded-xl p-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={tab === "kunjungan" ? "Cari nama, NIS, atau keluhan..." : "Cari nama obat..."}
            className="input-field pl-10" />
        </div>
        <div className="alat-aksi">
          {tab === "kunjungan" ? (
            <button onClick={openAdd} className="btn-modal-save">
              <Plus size={15} /> Tambah Kunjungan
            </button>
          ) : (
            <button onClick={openAddMed} className="btn-modal-save">
              <Plus size={15} /> Tambah Obat
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <PageSkeleton />
      ) : tab === "kunjungan" ? (
        <>
          {visits.length === 0 ? (
            <EmptyState icon={HeartPulse} title="Belum Ada Kunjungan" description="Tambahkan catatan kunjungan siswa ke UKS." />
          ) : filteredVisits.length === 0 ? (
            <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada kunjungan yang cocok dengan pencarian." />
          ) : (
            <div className="panel overflow-hidden">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {["Siswa", "Kelas", "Tanggal", "Keluhan", "Tindakan", "Obat Terpakai", ""].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisits.map(v => (
                      <tr key={v.id}>
                        <td>
                          <p className="font-semibold text-primary-900">{v.student.user.name}</p>
                          <p className="text-gray-400 text-xs font-mono">{v.student.nis}</p>
                        </td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{v.student.class?.name ?? "—"}</td>
                        <td className="text-gray-500 text-xs whitespace-nowrap">{fmt(v.visitDate)}</td>
                        <td className="text-gray-600">{v.complaint}</td>
                        <td className="text-gray-500 text-xs">{v.treatment || "-"}</td>
                        <td className="text-gray-500 text-xs">
                          {v.usages.length > 0 ? v.usages.map((u, i) => (
                            <span key={i} className="inline-block bg-primary-50 text-primary-700 rounded-full px-2 py-0.5 mr-1 mb-0.5">{u.medicine.name} ×{u.quantity}{u.medicine.unit}</span>
                          )) : "-"}
                        </td>
                        <td className="text-right whitespace-nowrap">
                          <button onClick={() => openEdit(v)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition" title="Ubah">
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
        ) : filteredMedicines.length === 0 ? (
          <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada obat yang cocok dengan pencarian." />
        ) : (
          <div className="panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    {["Nama Obat", "Stok", "Satuan", "Kedaluwarsa", "Catatan", ""].map(h => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMedicines.map(m => (
                    <tr key={m.id}>
                      <td className="font-semibold text-primary-900">{m.name}</td>
                      <td>
                        <span className={`font-bold ${m.stock <= (m.stokMinimum ?? 5) ? "text-red-500" : "text-emerald-600"}`}>{m.stock}</span>
                      </td>
                      <td className="text-gray-500 text-xs">{m.unit}</td>
                      <td className={`text-xs whitespace-nowrap ${m.kedaluwarsa && new Date(m.kedaluwarsa).getTime() <= Date.now() + 30 * 86400000 ? "font-semibold text-red-600" : "text-gray-500"}`}>{m.kedaluwarsa ? fmt(m.kedaluwarsa) : "-"}</td>
                      <td className="text-gray-500 text-xs">{m.notes || "-"}</td>
                      <td className="text-right whitespace-nowrap">
                        <button onClick={() => openEditMed(m)} className="p-1.5 rounded-lg hover:bg-primary-50 text-primary-700 transition" title="Ubah">
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

      <Modal scrollBody
        open={modal}
        onClose={() => setModal(false)}
        title={editing ? "Ubah Kunjungan" : "Tambah Kunjungan"}
        footer={
          <>
            <button type="button" onClick={() => setModal(false)} className="btn-modal-cancel flex-1">Batal</button>
            <button type="button" onClick={handleSave} disabled={saving} className="btn-modal-save flex-1">
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
          <div>
            <label className="label-field">Rujukan (opsional)</label>
            <input value={form.rujukan} onChange={e => setForm(p => ({ ...p, rujukan: e.target.value }))} placeholder="cth: Puskesmas, RS, dipulangkan ke asrama/rumah" className="input-field" />
          </div>
          {!editing && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={form.kabarOrtu} onChange={e => setForm(p => ({ ...p, kabarOrtu: e.target.checked }))} className="h-4 w-4 rounded border-gray-300" />
              Kabari orang tua lewat notifikasi (keluhan & rujukan, tanpa rincian obat)
            </label>
          )}
          {!editing && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="label-field mb-0">Obat Terpakai (opsional)</label>
                <button type="button" onClick={addUsageRow} className="text-xs font-semibold text-primary-700 hover:text-primary-900 flex items-center gap-1">
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
            <button type="button" onClick={handleSaveMed} disabled={savingMed} className="btn-modal-save flex-1">
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Kedaluwarsa</label>
              <DatePicker value={medForm.kedaluwarsa} onChange={v => setMedForm(p => ({ ...p, kedaluwarsa: v }))} placeholder="Tidak diisi" />
            </div>
            <div>
              <label className="label-field">Batas stok menipis</label>
              <input type="number" min={0} value={medForm.stokMinimum} onChange={e => setMedForm(p => ({ ...p, stokMinimum: e.target.value }))} className="input-field" />
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
