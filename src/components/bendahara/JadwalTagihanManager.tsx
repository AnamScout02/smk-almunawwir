"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Save, Loader2, CalendarClock, PauseCircle, PlayCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";

interface FeeType { id: string; name: string; defaultAmount: number; active: boolean }
interface ClassOption { id: string; name: string; grade: number }
interface ScheduleRow {
  id: string; name: string; periodType: string; startDate: string; frequency: number;
  dueDateOffsetDays: number; notes: string | null; active: boolean; generatedCount: number;
  feeType: { id: string; name: string }; class: { id: string; name: string } | null;
}

const PERIOD_LABEL: Record<string, string> = { MONTHLY: "Bulanan", DAILY: "Harian" };

/** Halaman "Jadwal Tagihan" (Tagihan Terjadwal) — portal Bendahara terpisah
 * (`/dashboard/bendahara/jadwal`). Beda dari "Generate Massal" (Tagihan Baru manual, sekali klik
 * per periode): jadwal di sini diproses OTOMATIS oleh scheduler in-process (lihat
 * instrumentation.ts + src/lib/billing-schedule.ts), tanpa perlu ada orang buka halaman ini
 * sama sekali setelah dibuat. Field inti (Jenis Biaya/Kelas/Periode/Mulai/Frekuensi/Jatuh Tempo)
 * SENGAJA tidak bisa diedit setelah dibuat (lihat komentar di API [id]/route.ts PUT) — kalau
 * salah, hapus & buat ulang. */
export default function JadwalTagihanManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [addModal, setAddModal] = useState(false);
  const [addName, setAddName] = useState("");
  const [addFeeTypeId, setAddFeeTypeId] = useState("");
  const [addClassId, setAddClassId] = useState("");
  const [addPeriodType, setAddPeriodType] = useState("MONTHLY");
  const [addStartDate, setAddStartDate] = useState("");
  const [addFrequency, setAddFrequency] = useState("12");
  const [addDueOffset, setAddDueOffset] = useState("10");
  const [addNotes, setAddNotes] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [editSchedule, setEditSchedule] = useState<ScheduleRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/bendahara/billing-schedules").then(r => r.json()).then(d => setSchedules(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    fetch("/api/bendahara/fee-types").then(r => r.json()).then(d => setFeeTypes(Array.isArray(d) ? d.filter((t: FeeType) => t.active) : [])).catch(() => {});
    fetch("/api/bendahara/classes").then(r => r.json()).then(d => setClasses(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  function openAdd() {
    setAddName(""); setAddFeeTypeId(""); setAddClassId(""); setAddPeriodType("MONTHLY");
    setAddStartDate(""); setAddFrequency("12"); setAddDueOffset("10"); setAddNotes("");
    setAddModal(true);
  }

  async function submitAdd() {
    if (!addName.trim()) { toast.warning("Isi nama jadwal."); return; }
    if (!addFeeTypeId) { toast.warning("Pilih jenis biaya."); return; }
    if (!addStartDate) { toast.warning("Isi tanggal mulai."); return; }
    const freq = Number(addFrequency);
    if (!freq || freq < 1 || freq > 500) { toast.warning("Frekuensi harus 1-500."); return; }
    setAddSaving(true);
    const res = await fetch("/api/bendahara/billing-schedules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: addName, feeTypeId: addFeeTypeId, classId: addClassId || undefined,
        periodType: addPeriodType, startDate: addStartDate, frequency: freq,
        dueDateOffsetDays: Number(addDueOffset) || 0, notes: addNotes || undefined,
      }),
    });
    setAddSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal membuat jadwal"); return; }
    toast.success(`Jadwal "${addName}" dibuat — akan generate otomatis sesuai periode.`);
    setAddModal(false); load();
  }

  function openEdit(s: ScheduleRow) {
    setEditSchedule(s); setEditName(s.name); setEditNotes(s.notes ?? "");
  }

  async function submitEdit() {
    if (!editSchedule) return;
    if (!editName.trim()) { toast.warning("Nama wajib diisi."); return; }
    setEditSaving(true);
    const res = await fetch(`/api/bendahara/billing-schedules/${editSchedule.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName, notes: editNotes || undefined, active: editSchedule.active }),
    });
    setEditSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    toast.success("Jadwal diperbarui.");
    setEditSchedule(null); load();
  }

  async function toggleActive(s: ScheduleRow) {
    const res = await fetch(`/api/bendahara/billing-schedules/${s.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: s.name, notes: s.notes ?? undefined, active: !s.active }),
    });
    if (!res.ok) { toast.error("Gagal mengubah status"); return; }
    toast.success(s.active ? "Jadwal dinonaktifkan." : "Jadwal diaktifkan kembali.");
    load();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus jadwal ini? Tagihan yang SUDAH ke-generate sebelumnya tidak ikut terhapus, cuma jadwalnya yang berhenti.")) return;
    const res = await fetch(`/api/bendahara/billing-schedules/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    load();
  }

  function statusBadge(s: ScheduleRow) {
    if (!s.active) return <span className="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-gray-50 text-gray-500 border-gray-200">Nonaktif</span>;
    if (s.generatedCount >= s.frequency) return <span className="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-blue-50 text-blue-700 border-blue-200">Selesai</span>;
    return <span className="status-badge inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200">Aktif</span>;
  }

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarClock size={22} />} title="Jadwal Tagihan" description="Tagihan berulang otomatis — generate sendiri tiap periode tanpa perlu klik manual" />

      <div className="alat-aksi justify-end mb-5">
        <button onClick={openAdd} className="btn-modal-save"><Plus size={15} /> Jadwal Baru</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
      ) : schedules.length === 0 ? (
        <EmptyState icon={CalendarClock} title="Belum Ada Jadwal Tagihan" description="Buat jadwal untuk generate tagihan otomatis tiap periode, mis. SPP bulanan." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th><th>Jenis Biaya</th><th>Kelas</th><th>Mulai</th><th>Periode</th>
                  <th>Progress</th><th>Jatuh Tempo</th><th>Status</th><th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {schedules.map(s => (
                  <tr key={s.id}>
                    <td>
                      <p className="font-semibold text-primary-900">{s.name}</p>
                      {s.notes && <p className="text-xs text-gray-400">{s.notes}</p>}
                    </td>
                    <td>{s.feeType.name}</td>
                    <td>{s.class?.name ?? "Semua Siswa Aktif"}</td>
                    <td>{new Date(s.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</td>
                    <td>{PERIOD_LABEL[s.periodType] ?? s.periodType}</td>
                    <td>{s.generatedCount}/{s.frequency}</td>
                    <td>+{s.dueDateOffsetDays} hari</td>
                    <td>{statusBadge(s)}</td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleActive(s)} title={s.active ? "Nonaktifkan" : "Aktifkan"}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors">
                          {s.active ? <PauseCircle size={14} /> : <PlayCircle size={14} />}
                        </button>
                        <button onClick={() => openEdit(s)} title="Edit" className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                        <button onClick={() => handleDelete(s.id)} title="Hapus" className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Jadwal Baru */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Jadwal Tagihan Baru" size="md"
        footer={<>
          <button onClick={() => setAddModal(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={submitAdd} disabled={addSaving} className="btn-modal-save">
            {addSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Nama Jadwal</label><input value={addName} onChange={e => setAddName(e.target.value)} className="input-field" placeholder="cth: SPP Bulanan XII AK 1" /></div>
          <div>
            <label className="label-field">Jenis Biaya</label>
            <Select value={addFeeTypeId} onChange={setAddFeeTypeId} options={feeTypes.map(f => ({ value: f.id, label: f.name }))} placeholder="— Pilih —" />
          </div>
          <div>
            <label className="label-field">Kelas</label>
            <Select value={addClassId} onChange={setAddClassId}
              options={[{ value: "", label: "Semua Siswa Aktif" }, ...classes.map(c => ({ value: c.id, label: c.name }))]} placeholder="— Pilih —" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label-field">Periode</label>
              <Select value={addPeriodType} onChange={setAddPeriodType} options={[{ value: "MONTHLY", label: "Bulanan" }, { value: "DAILY", label: "Harian" }]} />
            </div>
            <div><label className="label-field">Tanggal Mulai</label><DatePicker value={addStartDate} onChange={setAddStartDate} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-field">Frekuensi (1-500 kali)</label><input type="number" min={1} max={500} value={addFrequency} onChange={e => setAddFrequency(e.target.value)} className="input-field" /></div>
            <div><label className="label-field">Jatuh Tempo (hari setelah generate)</label><input type="number" min={0} value={addDueOffset} onChange={e => setAddDueOffset(e.target.value)} className="input-field" /></div>
          </div>
          <div><label className="label-field">Catatan (opsional)</label><textarea value={addNotes} onChange={e => setAddNotes(e.target.value)} rows={2} className="input-field" /></div>
          <p className="text-xs text-gray-400">Jumlah tagihan tiap siklus otomatis mengikuti jumlah default Jenis Biaya yang dipilih. Siswa yang sudah punya tagihan periode sama akan dilewati.</p>
        </div>
      </Modal>

      {/* Modal: Edit (cuma nama & catatan) */}
      <Modal open={!!editSchedule} onClose={() => setEditSchedule(null)}
        title="Edit Jadwal"
        description={editSchedule ? `${editSchedule.feeType.name} — ${PERIOD_LABEL[editSchedule.periodType]}` : undefined}
        size="sm"
        footer={<>
          <button onClick={() => setEditSchedule(null)} className="btn-modal-cancel">Batal</button>
          <button onClick={submitEdit} disabled={editSaving} className="btn-modal-save">
            {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          <div><label className="label-field">Nama Jadwal</label><input value={editName} onChange={e => setEditName(e.target.value)} className="input-field" /></div>
          <div><label className="label-field">Catatan</label><textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="input-field" /></div>
          <p className="text-xs text-gray-400">Jenis biaya, kelas, periode, tanggal mulai, frekuensi, dan jatuh tempo tidak bisa diubah setelah dibuat — hapus &amp; buat jadwal baru kalau perlu.</p>
        </div>
      </Modal>
    </div>
  );
}
