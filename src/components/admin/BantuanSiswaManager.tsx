"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { HandCoins, Loader2, Plus, Search, Edit2, Trash2, PackageCheck, Users, Wallet, Clock } from "lucide-react";
import StatTile from "@/components/admin/StatTile";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import StudentPicker, { type LookupStudent } from "@/components/admin/StudentPicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { JENIS_BANTUAN, STATUS_AMBIL, labelOf, styleOf, rupiah } from "@/lib/tu-konstanta";

interface BantuanRow {
  id: string; studentId: string;
  student: { id: string; nis: string; user: { name: string }; class: { name: string } | null; major: { code: string } };
  jenis: string; tahun: number; tahap: string | null; nominal: number; noSk: string | null;
  tanggalCair: string | null; bank: string | null; noRekening: string | null;
  statusAmbil: string; tanggalAmbil: string | null; diambilOleh: string | null; catatan: string | null;
}

const todayStr = () => new Date().toLocaleDateString("sv-SE");

interface FormState {
  studentId: string | null; jenis: string; tahun: string; tahap: string; nominal: string;
  noSk: string; tanggalCair: string; bank: string; noRekening: string;
  statusAmbil: string; tanggalAmbil: string; diambilOleh: string; catatan: string;
}
const EMPTY: FormState = {
  studentId: null, jenis: "PIP", tahun: String(new Date().getFullYear()), tahap: "", nominal: "",
  noSk: "", tanggalCair: "", bank: "", noRekening: "", statusAmbil: "BELUM", tanggalAmbil: "", diambilOleh: "", catatan: "",
};

export default function BantuanSiswaManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<BantuanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [picked, setPicked] = useState<LookupStudent | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/bantuan-siswa?year=${year}`)
      .then(r => r.json()).then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [year]);
  useEffect(() => { load(); }, [load]);

  function openAdd() { setEditingId(null); setForm({ ...EMPTY, tahun: year }); setPicked(null); setOpen(true); }
  function openEdit(r: BantuanRow) {
    setEditingId(r.id);
    setForm({
      studentId: r.studentId, jenis: r.jenis, tahun: String(r.tahun), tahap: r.tahap ?? "",
      nominal: String(r.nominal), noSk: r.noSk ?? "", tanggalCair: r.tanggalCair?.slice(0, 10) ?? "",
      bank: r.bank ?? "", noRekening: r.noRekening ?? "", statusAmbil: r.statusAmbil,
      tanggalAmbil: r.tanggalAmbil?.slice(0, 10) ?? "", diambilOleh: r.diambilOleh ?? "", catatan: r.catatan ?? "",
    });
    setPicked({ id: r.student.id, name: r.student.user.name, nis: r.student.nis, className: r.student.class?.name ?? null });
    setOpen(true);
  }

  async function save() {
    if (!form.studentId) return toast.error("Siswa wajib dipilih.");
    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/bantuan-siswa/${editingId}` : "/api/admin/bantuan-siswa", {
      method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, nominal: Number(form.nominal) || 0, tahun: Number(form.tahun) }),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) return toast.error("Gagal menyimpan data bantuan.");
    toast.success(editingId ? "Data diperbarui." : "Data bantuan dicatat.");
    setOpen(false); load();
  }

  async function tandaiDiambil(r: BantuanRow) {
    const res = await fetch(`/api/admin/bantuan-siswa/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusAmbil: "SUDAH", tanggalAmbil: todayStr() }),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menandai.");
    toast.success("Ditandai sudah diambil."); load();
  }

  async function hapus(r: BantuanRow) {
    if (!(await confirmDialog(`Hapus data bantuan "${r.student.user.name}"?`))) return;
    const res = await fetch(`/api/admin/bantuan-siswa/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Data dihapus."); load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.student.user.name.toLowerCase().includes(q) || r.student.nis.toLowerCase().includes(q) ||
        (r.noSk ?? "").toLowerCase().includes(q)) &&
      (!statusFilter || r.statusAmbil === statusFilter));
  }, [rows, search, statusFilter]);

  const total = useMemo(() => ({
    penerima: rows.length,
    nominal: rows.reduce((a, r) => a + r.nominal, 0),
    belum: rows.filter(r => r.statusAmbil === "BELUM").length,
  }), [rows]);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => String(now - i)).map(y => ({ value: y, label: `Tahun ${y}` }));
  }, []);

  const fmt = (d: string | null) => d ? new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<HandCoins size={22} />} title="Bantuan & Beasiswa Siswa"
        description="Penerima PIP, KIP, dan beasiswa lain — nominal, pencairan, dan status pengambilan" />

      {!loading && rows.length > 0 && (
        <div className="kisi-kartu kisi-kartu-3 mb-5">
          <StatTile value={total.penerima} label="Penerima" icon={Users} color="blue" />
          <StatTile value={rupiah(total.nominal)} label="Total Nominal" icon={Wallet} color="emerald" size="md" />
          <StatTile value={total.belum} label="Belum Diambil" icon={Clock} color="amber" />
        </div>
      )}

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-saring">
          <Select value={year} onChange={setYear} options={yearOptions} />
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari nama, NIS, no SK..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Semua Status"
            options={[{ value: "", label: "Semua Status" }, ...STATUS_AMBIL.map(s => ({ value: s.value, label: s.label }))]} />
        </div>
        <div className="alat-aksi">
          <button onClick={openAdd} className="btn-modal-save">
            <Plus size={16} /> Tambah Penerima
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary-500" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={HandCoins} title={`Belum Ada Data Tahun ${year}`} description="Catat penerima bantuan lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada data yang cocok dengan filter." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr><th>Siswa</th><th>Jenis</th><th>Tahap</th><th>Nominal</th><th>Cair</th><th>Bank/Rek</th><th>Status</th><th>Aksi</th></tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        {r.student.user.name}
                        <span className="block text-xs text-gray-400">{r.student.nis} · {r.student.class?.name ?? "—"}</span>
                      </td>
                      <td className="text-sm">{r.jenis}</td>
                      <td className="text-sm text-center">{r.tahap || "—"}</td>
                      <td className="text-sm whitespace-nowrap font-semibold">{rupiah(r.nominal)}</td>
                      <td className="text-sm whitespace-nowrap">{fmt(r.tanggalCair)}</td>
                      <td className="text-xs">{r.bank || "—"}{r.noRekening ? <span className="block text-gray-400">{r.noRekening}</span> : null}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${styleOf(STATUS_AMBIL, r.statusAmbil)}`}>
                          {labelOf(STATUS_AMBIL, r.statusAmbil)}
                        </span>
                        {r.tanggalAmbil && <span className="block text-xs text-gray-400 mt-0.5">{fmt(r.tanggalAmbil)}</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {r.statusAmbil === "BELUM" && (
                            <button onClick={() => tandaiDiambil(r)} title="Tandai Sudah Diambil"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"><PackageCheck size={14} /></button>
                          )}
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
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} penerima tahun {year}</p>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} scrollBody size="lg"
        title={editingId ? "Edit Data Bantuan" : "Tambah Penerima Bantuan"}
        footer={<>
          <button onClick={() => setOpen(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={save} disabled={saving} className="btn-modal-save">
            {saving && <Loader2 size={15} className="animate-spin" />} Simpan
          </button>
        </>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label-field">Siswa <span className="text-red-500">*</span></label>
            <StudentPicker value={picked} onChange={s => { setPicked(s); setForm(f => ({ ...f, studentId: s?.id ?? null })); }} />
          </div>
          <div>
            <label className="label-field">Jenis Bantuan</label>
            <Select value={form.jenis} onChange={v => setForm(f => ({ ...f, jenis: v }))}
              options={JENIS_BANTUAN.map(j => ({ value: j.value, label: j.label }))} />
          </div>
          <div>
            <label className="label-field">Tahun Anggaran</label>
            <Select value={form.tahun} onChange={v => setForm(f => ({ ...f, tahun: v }))} options={yearOptions} />
          </div>
          <div>
            <label className="label-field">Tahap</label>
            <input value={form.tahap} onChange={e => setForm(f => ({ ...f, tahap: e.target.value }))}
              placeholder="Mis. Tahap 1" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Nominal (Rp)</label>
            <input type="number" min={0} value={form.nominal}
              onChange={e => setForm(f => ({ ...f, nominal: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Nomor SK Penetapan</label>
            <input value={form.noSk} onChange={e => setForm(f => ({ ...f, noSk: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Tanggal Cair</label>
            <DatePicker value={form.tanggalCair} onChange={v => setForm(f => ({ ...f, tanggalCair: v }))} />
          </div>
          <div>
            <label className="label-field">Bank</label>
            <input value={form.bank} onChange={e => setForm(f => ({ ...f, bank: e.target.value }))}
              placeholder="Mis. BRI" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Nomor Rekening</label>
            <input value={form.noRekening} onChange={e => setForm(f => ({ ...f, noRekening: e.target.value }))} className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Status Pengambilan</label>
            <Select value={form.statusAmbil} onChange={v => setForm(f => ({ ...f, statusAmbil: v }))}
              options={STATUS_AMBIL.map(s => ({ value: s.value, label: s.label }))} />
          </div>
          <div>
            <label className="label-field">Tanggal Diambil</label>
            <DatePicker value={form.tanggalAmbil} onChange={v => setForm(f => ({ ...f, tanggalAmbil: v }))} />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Diambil Oleh</label>
            <input value={form.diambilOleh} onChange={e => setForm(f => ({ ...f, diambilOleh: e.target.value }))}
              placeholder="Nama pengambil (siswa/wali)" className="input-field w-full" />
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
