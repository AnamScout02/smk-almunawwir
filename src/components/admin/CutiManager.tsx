"use client";
import { useCariAwal } from "@/lib/cari-awal";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarOff, Loader2, Plus, Search, Edit2, Trash2, Check, X } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { JENIS_CUTI, STATUS_CUTI, KUOTA_CUTI_TAHUNAN, cutiMeta, hitungHariKerja, labelOf, styleOf } from "@/lib/tu-konstanta";

interface CutiRow {
  id: string; teacherId: string;
  teacher: { id: string; nip: string; position: string | null; user: { name: string } };
  jenis: string; startDate: string; endDate: string; days: number;
  reason: string; status: string; approvedBy: string | null; approvedAt: string | null; notes: string | null;
}
interface Pegawai { id: string; name: string; nip: string; position: string }

const todayStr = () => new Date().toLocaleDateString("sv-SE");

interface FormState {
  teacherId: string; jenis: string; startDate: string; endDate: string;
  days: string; reason: string; status: string; approvedBy: string; notes: string;
}
const EMPTY: FormState = {
  teacherId: "", jenis: "TAHUNAN", startDate: todayStr(), endDate: todayStr(),
  days: "1", reason: "", status: "DIAJUKAN", approvedBy: "", notes: "",
};

export default function CutiManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<CutiRow[]>([]);
  const [pegawai, setPegawai] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  useCariAwal(setSearch);
  const [statusFilter, setStatusFilter] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/cuti?year=${year}`)
      .then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetch("/api/admin/pegawai-lookup").then(r => r.json())
      .then(d => setPegawai(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  /** Sisa kuota cuti TAHUNAN per pegawai = 12 dikurangi total hari cuti tahunan yang sudah
   * DISETUJUI pada tahun itu. Dihitung on the fly dari daftar cuti (bukan kolom saldo tersimpan)
   * supaya angkanya tidak pernah menyimpang dari catatan cutinya sendiri. */
  const sisaKuota = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!cutiMeta(r.jenis).potongKuota || r.status !== "DISETUJUI") continue;
      m.set(r.teacherId, (m.get(r.teacherId) ?? 0) + r.days);
    }
    return m;
  }, [rows]);

  const terpakaiTerpilih = sisaKuota.get(form.teacherId) ?? 0;

  function openAdd() { setEditingId(null); setForm({ ...EMPTY, startDate: todayStr(), endDate: todayStr() }); setOpen(true); }
  function openEdit(r: CutiRow) {
    setEditingId(r.id);
    setForm({
      teacherId: r.teacherId, jenis: r.jenis, startDate: r.startDate.slice(0, 10), endDate: r.endDate.slice(0, 10),
      days: String(r.days), reason: r.reason, status: r.status, approvedBy: r.approvedBy ?? "", notes: r.notes ?? "",
    });
    setOpen(true);
  }

  /** Tanggal berubah -> lama cuti dihitung ulang otomatis (hari kerja, Minggu tidak dihitung). */
  function setTanggal(key: "startDate" | "endDate", v: string) {
    setForm(f => {
      const next = { ...f, [key]: v };
      return { ...next, days: String(hitungHariKerja(next.startDate, next.endDate) || 1) };
    });
  }

  async function save() {
    if (!form.teacherId) return toast.error("Pegawai wajib dipilih.");
    if (!form.reason.trim()) return toast.error("Alasan cuti wajib diisi.");
    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/cuti/${editingId}` : "/api/admin/cuti", {
      method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, days: Number(form.days) || 1 }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error("Gagal menyimpan data cuti.");
    toast.success(editingId ? "Data cuti diperbarui." : "Pengajuan cuti dicatat.");
    setOpen(false); load();
  }

  async function setStatus(r: CutiRow, status: string) {
    const res = await fetch(`/api/admin/cuti/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal mengubah status.");
    toast.success(status === "DISETUJUI" ? "Cuti disetujui." : "Cuti ditolak."); load();
  }

  async function hapus(r: CutiRow) {
    if (!(await confirmDialog(`Hapus data cuti "${r.teacher.user.name}"?`))) return;
    const res = await fetch(`/api/admin/cuti/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Data cuti dihapus."); load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.teacher.user.name.toLowerCase().includes(q) || r.teacher.nip.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)) &&
      (!statusFilter || r.status === statusFilter));
  }, [rows, search, statusFilter]);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(now - i)).map(y => ({ value: y, label: `Tahun ${y}` }));
  }, []);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<CalendarOff size={22} />} title="Cuti Pegawai"
        description={`Pengajuan & rekap cuti guru dan staf — kuota cuti tahunan ${KUOTA_CUTI_TAHUNAN} hari kerja per tahun`} />

      {/* Saringan & tombol aksi dalam satu baris (permintaan user 15 Sep 2026). */}
      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-saring">
          <Select value={year} onChange={setYear} options={yearOptions} />
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama pegawai, NIP, alasan..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Semua Status"
            options={[{ value: "", label: "Semua Status" }, ...STATUS_CUTI.map(s => ({ value: s.value, label: s.label }))]} />
        </div>
        <div className="alat-aksi">
          <button onClick={openAdd} className="btn-modal-save btn-teks">
            <Plus size={16} /> Ajukan Cuti
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarOff} title={`Belum Ada Cuti Tahun ${year}`} description="Catat pengajuan cuti lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada data cuti yang cocok dengan filter." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr><th>Pegawai</th><th>Jenis</th><th>Tanggal</th><th>Hari</th><th>Alasan</th><th>Sisa Kuota</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {filtered.map(r => {
                    const terpakai = sisaKuota.get(r.teacherId) ?? 0;
                    return (
                      <tr key={r.id}>
                        <td className="font-medium">
                          {r.teacher.user.name}
                          <span className="block text-xs text-gray-400">{r.teacher.nip}</span>
                        </td>
                        <td className="text-sm">{labelOf(JENIS_CUTI, r.jenis)}</td>
                        <td className="text-sm whitespace-nowrap">{fmt(r.startDate)} – {fmt(r.endDate)}</td>
                        <td className="text-center">{r.days}</td>
                        <td className="text-sm max-w-[14rem]">{r.reason}</td>
                        <td className="text-center text-sm">
                          {cutiMeta(r.jenis).potongKuota
                            ? <span className={terpakai > KUOTA_CUTI_TAHUNAN ? "text-red-600 font-semibold" : ""}>
                                {Math.max(0, KUOTA_CUTI_TAHUNAN - terpakai)}/{KUOTA_CUTI_TAHUNAN}
                              </span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td>
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(STATUS_CUTI, r.status)}`}>
                            {labelOf(STATUS_CUTI, r.status)}
                          </span>
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            {r.status !== "DISETUJUI" && (
                              <button onClick={() => setStatus(r, "DISETUJUI")} title="Setujui"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><Check size={14} /></button>
                            )}
                            {r.status !== "DITOLAK" && (
                              <button onClick={() => setStatus(r, "DITOLAK")} title="Tolak"
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><X size={14} /></button>
                            )}
                            <button onClick={() => openEdit(r)} title="Edit"
                              className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                            <button onClick={() => hapus(r)} title="Hapus"
                              className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} data cuti tahun {year}</p>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} scrollBody
        title={editingId ? "Edit Data Cuti" : "Ajukan Cuti Pegawai"}
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={save} disabled={saving} className="btn-modal-save">
            {saving && <Loader2 size={15} className="animate-spin" />} Simpan
          </button>
        </>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label-field">Pegawai <span className="text-red-500">*</span></label>
            <Select value={form.teacherId} onChange={v => setForm(f => ({ ...f, teacherId: v }))}
              placeholder="Pilih pegawai..."
              options={pegawai.map(p => ({ value: p.id, label: `${p.name}${p.nip ? ` — ${p.nip}` : ""}` }))} />
            {form.teacherId && cutiMeta(form.jenis).potongKuota && (
              <p className="text-xs text-gray-500 mt-1">
                Cuti tahunan terpakai {terpakaiTerpilih} hari — sisa {Math.max(0, KUOTA_CUTI_TAHUNAN - terpakaiTerpilih)} hari di tahun {year}.
              </p>
            )}
          </div>
          <div>
            <label className="label-field">Jenis Cuti</label>
            <Select value={form.jenis} onChange={v => setForm(f => ({ ...f, jenis: v }))}
              options={JENIS_CUTI.map(j => ({ value: j.value, label: j.label }))} />
          </div>
          <div>
            <label className="label-field">Lama (hari kerja)</label>
            <input type="number" min={1} value={form.days}
              onChange={e => setForm(f => ({ ...f, days: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Tanggal Mulai</label>
            <DatePicker value={form.startDate} onChange={v => setTanggal("startDate", v)} />
          </div>
          <div>
            <label className="label-field">Tanggal Selesai</label>
            <DatePicker value={form.endDate} onChange={v => setTanggal("endDate", v)} />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Alasan <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={2} className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Status</label>
            <Select value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))}
              options={STATUS_CUTI.map(s => ({ value: s.value, label: s.label }))} />
          </div>
          <div>
            <label className="label-field">Disetujui Oleh</label>
            <input value={form.approvedBy} onChange={e => setForm(f => ({ ...f, approvedBy: e.target.value }))}
              placeholder="Mis. Kepala Sekolah" className="input-field w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} className="input-field w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
