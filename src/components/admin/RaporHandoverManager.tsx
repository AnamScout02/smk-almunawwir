"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardCheck, Loader2, Plus, Search, Edit2, Trash2, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import StudentPicker, { type LookupStudent } from "@/components/admin/StudentPicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { SEMESTER_OPTIONS, HUBUNGAN_PENGAMBIL, labelOf } from "@/lib/tu-konstanta";

interface HandoverRow {
  id: string; studentId: string;
  student: { id: string; nis: string; user: { name: string }; class: { name: string } | null };
  academicYearId: string | null; academicYear: { id: string; name: string } | null;
  semester: string; tanggalAmbil: string; diambilOleh: string;
  hubungan: string | null; phone: string | null; catatan: string | null;
}
interface YearOpt { id: string; name: string; isActive: boolean }

const todayStr = () => new Date().toLocaleDateString("sv-SE");

interface FormState {
  studentId: string | null; academicYearId: string; semester: string;
  tanggalAmbil: string; diambilOleh: string; hubungan: string; phone: string; catatan: string;
}
const EMPTY: FormState = {
  studentId: null, academicYearId: "", semester: "GANJIL",
  tanggalAmbil: todayStr(), diambilOleh: "", hubungan: "", phone: "", catatan: "",
};

export default function RaporHandoverManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<HandoverRow[]>([]);
  const [years, setYears] = useState<YearOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState("");
  const [semesterFilter, setSemesterFilter] = useState("GANJIL");
  const [search, setSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [picked, setPicked] = useState<LookupStudent | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/tahun-ajaran").then(r => r.json()).then((d: YearOpt[]) => {
      if (!Array.isArray(d)) return;
      setYears(d);
      const aktif = d.find(y => y.isActive);
      if (aktif) setYearFilter(aktif.id);
    }).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    if (yearFilter) q.set("academicYearId", yearFilter);
    if (semesterFilter) q.set("semester", semesterFilter);
    fetch(`/api/admin/rapor-handover?${q}`)
      .then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [yearFilter, semesterFilter]);
  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY, academicYearId: yearFilter, semester: semesterFilter || "GANJIL", tanggalAmbil: todayStr() });
    setPicked(null); setOpen(true);
  }
  function openEdit(r: HandoverRow) {
    setEditingId(r.id);
    setForm({
      studentId: r.studentId, academicYearId: r.academicYearId ?? "", semester: r.semester,
      tanggalAmbil: r.tanggalAmbil.slice(0, 10), diambilOleh: r.diambilOleh,
      hubungan: r.hubungan ?? "", phone: r.phone ?? "", catatan: r.catatan ?? "",
    });
    setPicked({ id: r.student.id, name: r.student.user.name, nis: r.student.nis, className: r.student.class?.name ?? null });
    setOpen(true);
  }

  /** Default nama pengambil = nama siswa, karena sebagian besar rapor diambil siswa sendiri.
   * Tetap bisa diganti kalau yang datang wali. */
  function handlePick(s: LookupStudent | null) {
    setPicked(s);
    setForm(f => ({
      ...f, studentId: s?.id ?? null,
      diambilOleh: f.diambilOleh.trim() ? f.diambilOleh : (s?.name ?? ""),
    }));
  }

  async function save() {
    if (!form.studentId) return toast.error("Siswa wajib dipilih.");
    if (!form.diambilOleh.trim()) return toast.error("Nama pengambil wajib diisi.");
    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/rapor-handover/${editingId}` : "/api/admin/rapor-handover", {
      method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error("Gagal menyimpan data.");
    toast.success(editingId ? "Data diperbarui." : "Penerimaan rapor dicatat.");
    setOpen(false); load();
  }

  async function hapus(r: HandoverRow) {
    if (!(await confirmDialog(`Hapus catatan penerimaan rapor "${r.student.user.name}"?`))) return;
    const res = await fetch(`/api/admin/rapor-handover/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Data dihapus."); load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => !q || r.student.user.name.toLowerCase().includes(q) ||
      r.student.nis.toLowerCase().includes(q) || r.diambilOleh.toLowerCase().includes(q));
  }, [rows, search]);

  const fmt = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardCheck size={22} />} title="Penerimaan Rapor"
        description="Catatan siapa yang mengambil rapor tiap semester — bukti kalau nanti ada yang mengaku belum menerima" />

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-saring">
          <Select value={yearFilter} onChange={setYearFilter} placeholder="Semua Tahun Ajaran"
            options={[{ value: "", label: "Semua Tahun Ajaran" }, ...years.map(y => ({ value: y.id, label: y.name + (y.isActive ? " (aktif)" : "") }))]} />
        </div>
        <div className="alat-saring">
          <Select value={semesterFilter} onChange={setSemesterFilter} placeholder="Semua Semester"
            options={[{ value: "", label: "Semua Semester" }, ...SEMESTER_OPTIONS.map(s => ({ value: s.value, label: s.label }))]} />
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama siswa, NIS, pengambil..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-aksi">
          <button onClick={openAdd} className="btn-modal-save btn-teks">
            <Plus size={16} /> Catat Penerimaan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Belum Ada Catatan" description="Catat penerimaan rapor pertama lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada data yang cocok." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr><th>Siswa</th><th>Tahun / Semester</th><th>Tanggal Ambil</th><th>Diambil Oleh</th><th>Hubungan</th><th>No. HP</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        {r.student.user.name}
                        <span className="block text-xs text-gray-400">{r.student.nis} · {r.student.class?.name ?? "—"}</span>
                      </td>
                      <td className="text-sm whitespace-nowrap">
                        {r.academicYear?.name ?? "—"}
                        <span className="block text-xs text-gray-400">{labelOf(SEMESTER_OPTIONS, r.semester)}</span>
                      </td>
                      <td className="text-sm whitespace-nowrap">{fmt(r.tanggalAmbil)}</td>
                      <td className="text-sm">{r.diambilOleh}</td>
                      <td className="text-sm">{r.hubungan || "—"}</td>
                      <td className="text-sm">{r.phone || "—"}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(r)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => hapus(r)} title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} catatan</p>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} scrollBody
        title={editingId ? "Edit Penerimaan Rapor" : "Catat Penerimaan Rapor"}
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={save} disabled={saving} className="btn-modal-save">
            {saving && <Loader2 size={15} className="animate-spin" />} Simpan
          </button>
        </>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label-field">Siswa <span className="text-red-500">*</span></label>
            <StudentPicker value={picked} onChange={handlePick} />
          </div>
          <div>
            <label className="label-field">Tahun Ajaran</label>
            <Select value={form.academicYearId} onChange={v => setForm(f => ({ ...f, academicYearId: v }))}
              placeholder="Pilih tahun ajaran..."
              options={years.map(y => ({ value: y.id, label: y.name + (y.isActive ? " (aktif)" : "") }))} />
          </div>
          <div>
            <label className="label-field">Semester</label>
            <Select value={form.semester} onChange={v => setForm(f => ({ ...f, semester: v }))}
              options={SEMESTER_OPTIONS.map(s => ({ value: s.value, label: s.label }))} />
          </div>
          <div>
            <label className="label-field">Tanggal Ambil</label>
            <DatePicker value={form.tanggalAmbil} onChange={v => setForm(f => ({ ...f, tanggalAmbil: v }))} />
          </div>
          <div>
            <label className="label-field">Hubungan</label>
            <Select value={form.hubungan} onChange={v => setForm(f => ({ ...f, hubungan: v }))}
              placeholder="Pilih hubungan..."
              options={HUBUNGAN_PENGAMBIL.map(h => ({ value: h.value, label: h.label }))} />
          </div>
          <div>
            <label className="label-field">Diambil Oleh <span className="text-red-500">*</span></label>
            <input value={form.diambilOleh} onChange={e => setForm(f => ({ ...f, diambilOleh: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">No. HP</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Catatan</label>
            <textarea value={form.catatan} onChange={e => setForm(f => ({ ...f, catatan: e.target.value }))}
              rows={2} className="input-field w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
