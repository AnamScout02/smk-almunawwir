"use client";
import { useCariAwal } from "@/lib/cari-awal";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Stamp, Loader2, Plus, Search, Printer, Edit2, Trash2, Check, PackageCheck, FileCheck2, Clock, CheckCircle2 } from "lucide-react";
import StatTile from "@/components/admin/StatTile";
import PageHeader from "@/components/admin/PageHeader";
import EmptyState from "@/components/admin/EmptyState";
import Modal from "@/components/admin/Modal";
import Select from "@/components/admin/Select";
import DatePicker from "@/components/shared/DatePicker";
import MonthPicker from "@/components/shared/MonthPicker";
import StudentPicker, { type LookupStudent } from "@/components/admin/StudentPicker";
import { useToast } from "@/components/shared/ToastProvider";
import { useConfirm } from "@/components/shared/ConfirmProvider";

interface LegalisirRow {
  id: string; requestDate: string; studentId: string | null;
  student: { id: string; nis: string; enrollYear: number | null; studentStatus: string | null; user: { name: string }; major: { code: string } } | null;
  applicantName: string; documentType: string; documentNo: string | null;
  copies: number; purpose: string; signedBy: string | null;
  status: string; pickupDate: string | null; notes: string | null;
}

export const DOC_TYPES = [
  { value: "IJAZAH", label: "Ijazah" },
  { value: "SKHUN", label: "SKHUN" },
  { value: "RAPOR", label: "Rapor" },
  { value: "SKL", label: "Surat Keterangan Lulus" },
  { value: "LAINNYA", label: "Lainnya" },
];

const STATUS_OPTIONS = [
  { value: "DIPROSES", label: "Diproses" },
  { value: "SELESAI", label: "Selesai (siap diambil)" },
  { value: "DIAMBIL", label: "Sudah Diambil" },
];

const STATUS_STYLE: Record<string, string> = {
  DIPROSES: "bg-amber-50 text-amber-700 border-amber-200",
  SELESAI: "bg-blue-50 text-blue-700 border-blue-200",
  DIAMBIL: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const todayStr = () => new Date().toLocaleDateString("sv-SE");
const thisMonth = () => todayStr().slice(0, 7);

interface FormState {
  requestDate: string; studentId: string | null; applicantName: string;
  documentType: string; documentNo: string; copies: string;
  purpose: string; signedBy: string; status: string; notes: string;
}

const EMPTY_FORM: FormState = {
  requestDate: todayStr(), studentId: null, applicantName: "",
  documentType: "IJAZAH", documentNo: "", copies: "1",
  purpose: "", signedBy: "", status: "DIPROSES", notes: "",
};

export default function LegalisirManager() {
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [rows, setRows] = useState<LegalisirRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(thisMonth());
  const [search, setSearch] = useState("");
  useCariAwal(setSearch);
  const [statusFilter, setStatusFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [picked, setPicked] = useState<LookupStudent | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/legalisir?month=${month}`)
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [month]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, requestDate: todayStr() });
    setPicked(null);
    setModalOpen(true);
  }

  function openEdit(r: LegalisirRow) {
    setEditingId(r.id);
    setForm({
      requestDate: r.requestDate.slice(0, 10), studentId: r.studentId, applicantName: r.applicantName,
      documentType: r.documentType, documentNo: r.documentNo ?? "", copies: String(r.copies),
      purpose: r.purpose, signedBy: r.signedBy ?? "", status: r.status, notes: r.notes ?? "",
    });
    setPicked(r.student ? {
      id: r.student.id, name: r.student.user.name, nis: r.student.nis,
      enrollYear: r.student.enrollYear, status: r.student.studentStatus ?? undefined, majorCode: r.student.major.code,
    } : null);
    setModalOpen(true);
  }

  /** Begitu siswa dipilih: nama pemohon & nomor dokumen ikut terisi otomatis dari Buku Induk —
   * ini inti nilai fitur ini (TU tidak perlu ketik ulang nomor ijazah yang panjang). Tetap bisa
   * diedit manual setelahnya (mis. pemohon diwakilkan keluarga, atau alumni lama datanya kosong). */
  function handlePickStudent(s: LookupStudent | null) {
    setPicked(s);
    if (!s) return setForm(f => ({ ...f, studentId: null }));
    setForm(f => ({
      ...f,
      studentId: s.id,
      applicantName: f.applicantName.trim() ? f.applicantName : s.name,
      documentNo: docNoFor(f.documentType, s) ?? f.documentNo,
    }));
  }

  function docNoFor(type: string, s: LookupStudent | null): string | null {
    if (!s) return null;
    if (type === "IJAZAH") return s.graduationIjazahNo ?? null;
    if (type === "SKHUN") return s.skhunNo ?? null;
    return null;
  }

  function handleDocTypeChange(v: string) {
    setForm(f => ({ ...f, documentType: v, documentNo: docNoFor(v, picked) ?? "" }));
  }

  async function handleSave() {
    if (!form.applicantName.trim()) return toast.error("Nama pemohon wajib diisi.");
    if (!form.purpose.trim()) return toast.error("Keperluan wajib diisi.");

    setSaving(true);
    const res = await fetch(editingId ? `/api/admin/legalisir/${editingId}` : "/api/admin/legalisir", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, copies: Number(form.copies) || 1 }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) return toast.error("Gagal menyimpan permintaan legalisir.");
    toast.success(editingId ? "Permintaan diperbarui." : "Permintaan legalisir dicatat.");
    setModalOpen(false);
    load();
  }

  async function setStatus(r: LegalisirRow, status: string) {
    const body: Record<string, unknown> = { status };
    if (status === "DIAMBIL") body.pickupDate = todayStr();
    const res = await fetch(`/api/admin/legalisir/${r.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal mengubah status.");
    toast.success(status === "DIAMBIL" ? "Ditandai sudah diambil." : "Ditandai selesai.");
    load();
  }

  async function handleDelete(r: LegalisirRow) {
    if (!(await confirmDialog(`Hapus permintaan legalisir atas nama "${r.applicantName}"?`))) return;
    const res = await fetch(`/api/admin/legalisir/${r.id}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) return toast.error("Gagal menghapus.");
    toast.success("Permintaan dihapus.");
    load();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      (!q || r.applicantName.toLowerCase().includes(q) || (r.student?.user.name ?? "").toLowerCase().includes(q) ||
        (r.documentNo ?? "").toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q)) &&
      (!statusFilter || r.status === statusFilter)
    );
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => ({
    diproses: rows.filter(r => r.status === "DIPROSES").length,
    selesai: rows.filter(r => r.status === "SELESAI").length,
    diambil: rows.filter(r => r.status === "DIAMBIL").length,
  }), [rows]);

  const fmtDate = (d: string) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  const docLabel = (v: string) => DOC_TYPES.find(d => d.value === v)?.label ?? v;

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Stamp size={22} />} title="Legalisir Ijazah & Dokumen"
        description="Catatan permintaan legalisir dokumen — otomatis mengambil nomor ijazah dari Buku Induk" />

      {!loading && rows.length > 0 && (
        <div className="kisi-kartu kisi-kartu-3 mb-5">
          <StatTile value={counts.diproses} label="Diproses" icon={Clock} color="amber" />
          <StatTile value={counts.selesai} label="Siap Diambil" icon={Stamp} color="blue" />
          <StatTile value={counts.diambil} label="Sudah Diambil" icon={CheckCircle2} color="emerald" />
        </div>
      )}

      <div className="page-card p-4 mb-5 baris-alat">
        <div className="alat-saring">
          <MonthPicker value={month} onChange={setMonth} />
        </div>
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Cari pemohon, no dokumen, keperluan..." className="input-field pl-10 w-full" />
        </div>
        <div className="alat-saring">
          <Select value={statusFilter} onChange={setStatusFilter} placeholder="Semua Status"
            options={[{ value: "", label: "Semua Status" }, ...STATUS_OPTIONS]} />
        </div>
        <div className="alat-aksi">
          <Link href={`/dashboard/admin/legalisir/cetak?month=${month}`} className="btn-modal-cancel">
            <Printer size={16} /> Cetak Rekap Bulan Ini
          </Link>
          <button onClick={openAdd} className="btn-modal-save">
            <Plus size={16} /> Tambah Permintaan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileCheck2} title="Belum Ada Permintaan Bulan Ini" description="Catat permintaan legalisir pertama lewat tombol di atas." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={Search} title="Tidak Ditemukan" description="Tidak ada permintaan yang cocok dengan filter." />
      ) : (
        <>
          <div className="page-card overflow-hidden">
            <div className="overflow-auto scrollbar-visible">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tanggal</th><th>Pemohon</th><th>Dokumen</th><th>No. Dokumen</th>
                    <th>Rangkap</th><th>Keperluan</th><th>Status</th><th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{fmtDate(r.requestDate)}</td>
                      <td className="font-medium">
                        {r.applicantName}
                        {r.student && (
                          <span className="block text-xs text-gray-400">
                            {r.student.user.name} · {r.student.nis}{r.student.enrollYear ? ` · Angkatan ${r.student.enrollYear}` : ""}
                          </span>
                        )}
                      </td>
                      <td className="text-sm">{docLabel(r.documentType)}</td>
                      <td className="text-xs break-words max-w-[12rem]">{r.documentNo || "—"}</td>
                      <td className="text-center">{r.copies}</td>
                      <td className="text-sm max-w-[14rem]">{r.purpose}</td>
                      <td>
                        <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_STYLE[r.status] ?? STATUS_STYLE.DIPROSES}`}>
                          {STATUS_OPTIONS.find(s => s.value === r.status)?.label ?? r.status}
                        </span>
                        {r.pickupDate && <span className="block text-xs text-gray-400 mt-0.5">{fmtDate(r.pickupDate)}</span>}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          {r.status === "DIPROSES" && (
                            <button onClick={() => setStatus(r, "SELESAI")} title="Tandai Selesai"
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Check size={14} />
                            </button>
                          )}
                          {r.status !== "DIAMBIL" && (
                            <button onClick={() => setStatus(r, "DIAMBIL")} title="Tandai Sudah Diambil"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <PackageCheck size={14} />
                            </button>
                          )}
                          <button onClick={() => openEdit(r)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(r)} title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Menampilkan {filtered.length} dari {rows.length} permintaan bulan ini</p>
        </>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} scrollBody size="lg"
        title={editingId ? "Edit Permintaan Legalisir" : "Tambah Permintaan Legalisir"}
        description={editingId ? undefined : "Cari nama siswa/alumni dulu supaya nomor dokumen terisi otomatis"}
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="btn-modal-cancel">Batal</button>
            <button onClick={handleSave} disabled={saving} className="btn-modal-save">
              {saving && <Loader2 size={15} className="animate-spin" />} Simpan
            </button>
          </>
        }>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="label-field">Cari Siswa / Alumni</label>
            <StudentPicker value={picked} onChange={handlePickStudent}
              placeholder="Ketik nama atau NIS alumni (min. 2 huruf)..." />
            <p className="text-xs text-gray-400 mt-1">
              Kosongkan kalau alumni lama belum ada di Buku Induk — isi nama & nomor dokumen manual saja.
            </p>
          </div>

          <div>
            <label className="label-field">Tanggal Permintaan</label>
            <DatePicker value={form.requestDate} onChange={v => setForm(f => ({ ...f, requestDate: v }))} />
          </div>
          <div>
            <label className="label-field">Nama Pemohon <span className="text-red-500">*</span></label>
            <input value={form.applicantName} onChange={e => setForm(f => ({ ...f, applicantName: e.target.value }))}
              placeholder="Nama orang yang datang" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Jenis Dokumen</label>
            <Select value={form.documentType} onChange={handleDocTypeChange} options={DOC_TYPES} />
          </div>
          <div>
            <label className="label-field">Jumlah Rangkap</label>
            <input type="number" min={1} value={form.copies}
              onChange={e => setForm(f => ({ ...f, copies: e.target.value }))} className="input-field w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Nomor Dokumen</label>
            <input value={form.documentNo} onChange={e => setForm(f => ({ ...f, documentNo: e.target.value }))}
              placeholder="Otomatis terisi kalau siswa ditemukan & datanya lengkap" className="input-field w-full" />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Keperluan <span className="text-red-500">*</span></label>
            <textarea value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
              rows={2} placeholder="Mis. Lamaran kerja / daftar kuliah" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Ditandatangani Oleh</label>
            <input value={form.signedBy} onChange={e => setForm(f => ({ ...f, signedBy: e.target.value }))}
              placeholder="Mis. Kepala Sekolah" className="input-field w-full" />
          </div>
          <div>
            <label className="label-field">Status</label>
            <Select value={form.status} onChange={v => setForm(f => ({ ...f, status: v }))} options={STATUS_OPTIONS} />
          </div>
          <div className="md:col-span-2">
            <label className="label-field">Catatan</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Opsional" className="input-field w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
