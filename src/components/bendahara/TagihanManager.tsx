"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Wallet, Plus, Trash2, Pencil, Save, Loader2, Search, ClipboardList,
  CheckCircle2, Clock, Download, Layers, Users, Printer,
} from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import Modal from "@/components/admin/Modal";
import EmptyState from "@/components/admin/EmptyState";
import StatTile from "@/components/admin/StatTile";
import MonthPicker from "@/components/shared/MonthPicker";
import DatePicker from "@/components/shared/DatePicker";
import { useConfirm } from "@/components/shared/ConfirmProvider";
import { useToast } from "@/components/shared/ToastProvider";
import { formatRupiah } from "@/lib/currency";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeeType { id: string; name: string; defaultAmount: number; active: boolean }
interface ClassOption { id: string; name: string; grade: number }
interface StudentHit { id: string; nis: string; name: string; className: string }
interface InvoiceRow {
  id: string; period: string; amount: number; paidAmount: number;
  paidAt: string | null; dueDate: string | null; paymentMethod: string | null; notes: string | null;
  student: { id: string; nis: string; user: { name: string }; class: { id: string; name: string } | null };
  feeType: { id: string; name: string };
}

type Status = "LUNAS" | "BELUM_LUNAS" | "TERLAMBAT";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function invoiceStatus(inv: InvoiceRow): Status {
  if (inv.paidAmount >= inv.amount) return "LUNAS";
  if (inv.dueDate && new Date(inv.dueDate) < new Date()) return "TERLAMBAT";
  return "BELUM_LUNAS";
}

const STATUS_BADGE: Record<Status, string> = {
  LUNAS: "bg-emerald-50 text-emerald-700 border-emerald-200",
  BELUM_LUNAS: "bg-amber-50 text-amber-700 border-amber-200",
  TERLAMBAT: "bg-red-50 text-red-600 border-red-200",
};
const STATUS_LABEL: Record<Status, string> = { LUNAS: "Lunas", BELUM_LUNAS: "Belum Lunas", TERLAMBAT: "Terlambat" };

/** Halaman "Tagihan" — portal Bendahara terpisah (`/dashboard/bendahara/tagihan`). Dipecah dari
 * bekas `BendaharaManager.tsx` (tab-based) supaya konsisten dgn pola navigasi portal lain di app
 * ini (href terpisah per halaman lewat sidebar, bukan tab dalam satu halaman) — lihat
 * `BendaharaSidebar.tsx`. Endpoint API sudah pindah ke `/api/bendahara/**` (bukan
 * `/api/admin/bendahara/**` lagi). */
export default function TagihanManager() {
  const confirmDialog = useConfirm();
  const toast = useToast();

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [classFilter, setClassFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState(currentMonth());
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");

  const [addModal, setAddModal] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addClassFilter, setAddClassFilter] = useState("");
  const [addHits, setAddHits] = useState<StudentHit[]>([]);
  const [addSearching, setAddSearching] = useState(false);
  const [addStudent, setAddStudent] = useState<StudentHit | null>(null);
  const [addFeeTypeId, setAddFeeTypeId] = useState("");
  const [addAmount, setAddAmount] = useState("");
  const [addPeriod, setAddPeriod] = useState(currentMonth());
  const [addDueDate, setAddDueDate] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  const [genModal, setGenModal] = useState(false);
  const [genFeeTypeId, setGenFeeTypeId] = useState("");
  const [genPeriod, setGenPeriod] = useState(currentMonth());
  const [genClassId, setGenClassId] = useState("");
  const [genSaving, setGenSaving] = useState(false);

  const [editInvoice, setEditInvoice] = useState<InvoiceRow | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPaidAmount, setEditPaidAmount] = useState("");
  const [editPaidAt, setEditPaidAt] = useState("");
  const [editMethod, setEditMethod] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function loadInvoices() {
    setLoading(true);
    const params = new URLSearchParams();
    if (classFilter !== "ALL") params.set("classId", classFilter);
    if (periodFilter) params.set("period", periodFilter);
    fetch(`/api/bendahara/invoices?${params.toString()}`)
      .then(r => r.json()).then(d => setInvoices(Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => {
    fetch("/api/bendahara/classes").then(r => r.json()).then(d => setClasses(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/bendahara/fee-types").then(r => r.json()).then(d => setFeeTypes(Array.isArray(d) ? d.filter((t: FeeType) => t.active) : [])).catch(() => {});
  }, []);
  useEffect(() => { loadInvoices(); }, [classFilter, periodFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Kelas dipilih -> boleh browse SELURUH siswa kelas itu tanpa ketik nama (q kosong).
    // Kalau kelas TIDAK dipilih, tetap wajib ketik min. 2 huruf spt sebelumnya.
    if (addQuery.trim().length < 2 && !addClassFilter) { setAddHits([]); return; }
    setAddSearching(true);
    const params = new URLSearchParams();
    if (addQuery.trim().length >= 2) params.set("q", addQuery.trim());
    if (addClassFilter) params.set("classId", addClassFilter);
    const t = setTimeout(() => {
      fetch(`/api/bendahara/students-lookup?${params.toString()}`)
        .then(r => r.json()).then(d => { if (Array.isArray(d)) setAddHits(d); })
        .catch(() => {}).finally(() => setAddSearching(false));
    }, addClassFilter && addQuery.trim().length < 2 ? 0 : 300); // pilih kelas -> langsung tampil, tanpa jeda ngetik
    return () => clearTimeout(t);
  }, [addQuery, addClassFilter]);

  const filtered = statusFilter === "ALL" ? invoices : invoices.filter(inv => invoiceStatus(inv) === statusFilter);
  const totalTagihan = filtered.reduce((a, inv) => a + inv.amount, 0);
  const totalTerbayar = filtered.reduce((a, inv) => a + inv.paidAmount, 0);
  const belumLunasCount = filtered.filter(inv => invoiceStatus(inv) !== "LUNAS").length;

  function openAdd() {
    setAddStudent(null); setAddQuery(""); setAddClassFilter(""); setAddHits([]);
    setAddFeeTypeId(""); setAddAmount(""); setAddPeriod(periodFilter || currentMonth()); setAddDueDate("");
    setAddModal(true);
  }

  async function submitAdd() {
    if (!addStudent) { toast.warning("Pilih siswa dulu."); return; }
    if (!addFeeTypeId) { toast.warning("Pilih jenis biaya."); return; }
    const amt = Number(addAmount);
    if (!addAmount || isNaN(amt) || amt < 0) { toast.warning("Isi jumlah tagihan."); return; }
    if (!addPeriod) { toast.warning("Isi periode."); return; }
    setAddSaving(true);
    const res = await fetch("/api/bendahara/invoices", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: addStudent.id, feeTypeId: addFeeTypeId, period: addPeriod, amount: amt, dueDate: addDueDate || undefined }),
    });
    setAddSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal membuat tagihan"); return; }
    toast.success(`Tagihan untuk ${addStudent.name} dibuat.`);
    setAddModal(false); loadInvoices();
  }

  function openGenerate() {
    setGenFeeTypeId(""); setGenPeriod(periodFilter || currentMonth()); setGenClassId("");
    setGenModal(true);
  }

  async function submitGenerate() {
    if (!genFeeTypeId) { toast.warning("Pilih jenis biaya."); return; }
    if (!genPeriod) { toast.warning("Isi periode."); return; }
    setGenSaving(true);
    const res = await fetch("/api/bendahara/invoices/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feeTypeId: genFeeTypeId, period: genPeriod, classId: genClassId || undefined }),
    });
    const d = await res.json();
    setGenSaving(false);
    if (!res.ok) { toast.error(d.error || "Gagal generate tagihan"); return; }
    toast.success(`${d.created} tagihan dibuat${d.skipped > 0 ? `, ${d.skipped} dilewati (sudah ada)` : ""}.`);
    setGenModal(false); loadInvoices();
  }

  function openEdit(inv: InvoiceRow, quickPay = false) {
    setEditInvoice(inv);
    setEditAmount(String(inv.amount));
    setEditDueDate(inv.dueDate ? inv.dueDate.slice(0, 10) : "");
    setEditPaidAmount(quickPay ? String(inv.amount) : String(inv.paidAmount));
    setEditPaidAt(quickPay ? new Date().toISOString().slice(0, 10) : (inv.paidAt ? inv.paidAt.slice(0, 10) : ""));
    setEditMethod(inv.paymentMethod ?? "");
    setEditNotes(inv.notes ?? "");
  }

  async function submitEdit() {
    if (!editInvoice) return;
    const amt = Number(editAmount), paid = Number(editPaidAmount);
    if (isNaN(amt) || amt < 0 || isNaN(paid) || paid < 0) { toast.warning("Jumlah tidak valid."); return; }
    setEditSaving(true);
    const res = await fetch(`/api/bendahara/invoices/${editInvoice.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: amt, dueDate: editDueDate || undefined, paidAmount: paid,
        paidAt: editPaidAt || undefined, paymentMethod: editMethod || undefined, notes: editNotes || undefined,
      }),
    });
    setEditSaving(false);
    if (!res.ok) { const d = await res.json(); toast.error(d.error || "Gagal menyimpan"); return; }
    toast.success("Tagihan diperbarui.");
    setEditInvoice(null); loadInvoices();
  }

  async function handleDelete(id: string) {
    if (!await confirmDialog("Hapus tagihan ini? Tindakan ini tidak bisa dibatalkan.")) return;
    const res = await fetch(`/api/bendahara/invoices/${id}`, { method: "DELETE" });
    if (!res.ok) { toast.error("Gagal menghapus"); return; }
    loadInvoices();
  }

  const exportParams = new URLSearchParams();
  if (classFilter !== "ALL") exportParams.set("classId", classFilter);
  if (periodFilter) exportParams.set("period", periodFilter);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<ClipboardList size={22} />} title="Tagihan" description="Kelola tagihan siswa — SPP dan biaya lainnya" />

      <div className="kisi-kartu kisi-kartu-3 mb-5">
        <StatTile color="primary" icon={<Wallet />} value={formatRupiah(totalTagihan)} size="md" label="Total Tagihan" />
        <StatTile color="emerald" icon={<CheckCircle2 />} value={formatRupiah(totalTerbayar)} size="md" label="Total Terbayar" />
        <StatTile color="amber" icon={<Clock />} value={belumLunasCount} size="md" label="Belum Lunas" />
      </div>

      <div className="baris-alat items-end mb-5">
        <div className="alat-saring">
          <label className="label-field">Kelas</label>
          <Select value={classFilter} onChange={setClassFilter}
            options={[{ value: "ALL", label: "Semua Kelas" }, ...classes.map(c => ({ value: c.id, label: c.name }))]} />
        </div>
        <div className="alat-saring">
          <label className="label-field">Periode</label>
          <MonthPicker value={periodFilter} onChange={setPeriodFilter} />
        </div>
        <div className="alat-saring">
          <label className="label-field">Status</label>
          <Select value={statusFilter} onChange={v => setStatusFilter(v as "ALL" | Status)}
            options={[{ value: "ALL", label: "Semua Status" }, { value: "LUNAS", label: "Lunas" }, { value: "BELUM_LUNAS", label: "Belum Lunas" }, { value: "TERLAMBAT", label: "Terlambat" }]} />
        </div>
        <div className="alat-aksi">
          <a href={`/api/bendahara/export?${exportParams.toString()}`}
            className="btn-modal-cancel">
            <Download size={15} /> Unduh Excel
          </a>
          <button onClick={openGenerate} className="btn-modal-cancel">
            <Layers size={15} /> Generate Massal
          </button>
          <button onClick={openAdd} className="btn-modal-save"><Plus size={15} /> Tagihan Baru</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-gray-400" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Wallet} title="Belum Ada Tagihan" description="Buat tagihan baru atau generate massal per kelas untuk mulai." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Siswa</th><th>Kelas</th><th>Jenis Biaya</th><th>Periode</th>
                  <th>Jumlah</th><th>Status</th><th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => {
                  const status = invoiceStatus(inv);
                  return (
                    <tr key={inv.id}>
                      <td>
                        <p className="font-semibold text-primary-900">{inv.student.user.name}</p>
                        <p className="text-xs text-gray-400">{inv.student.nis}</p>
                      </td>
                      <td>{inv.student.class?.name ?? "—"}</td>
                      <td>{inv.feeType.name}</td>
                      <td>{inv.period}</td>
                      <td>
                        <p className="font-semibold">{formatRupiah(inv.amount)}</p>
                        {inv.paidAmount > 0 && inv.paidAmount < inv.amount && (
                          <p className="text-xs text-gray-400">{formatRupiah(inv.paidAmount)} dibayar</p>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_BADGE[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {status !== "LUNAS" && (
                            <button onClick={() => openEdit(inv, true)} title="Tandai Lunas"
                              className="px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-100 font-semibold transition-colors">
                              Tandai Lunas
                            </button>
                          )}
                          <Link href={`/dashboard/bendahara/tagihan/${inv.id}/cetak`} title="Cetak Kwitansi"
                            className="p-1.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Printer size={14} />
                          </Link>
                          <button onClick={() => openEdit(inv)} title="Edit"
                            className="p-1.5 text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleDelete(inv.id)} title="Hapus"
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Tagihan Baru */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Tagihan Baru" size="md"
        footer={<>
          <button onClick={() => setAddModal(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={submitAdd} disabled={addSaving} className="btn-modal-save">
            {addSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Siswa</label>
            {addStudent ? (
              <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-xl px-4 py-2.5">
                <div><p className="font-semibold text-primary-900 text-sm">{addStudent.name}</p><p className="text-xs text-gray-400">{addStudent.nis} · {addStudent.className}</p></div>
                <button onClick={() => { setAddStudent(null); setAddQuery(""); }} className="text-xs text-red-500 font-semibold">Ganti</button>
              </div>
            ) : (
              <div>
                <Select value={addClassFilter} onChange={setAddClassFilter}
                  options={[{ value: "", label: "— Semua Kelas (ketik nama) —" }, ...classes.map(c => ({ value: c.id, label: c.name }))]}
                  placeholder="Pilih kelas dulu (opsional, mempermudah)" className="mb-2" />
                <div className="relative">
                  <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={addQuery} onChange={e => setAddQuery(e.target.value)}
                    placeholder={addClassFilter ? "Cari nama dlm kelas ini (opsional)..." : "Cari nama atau NIS siswa..."} className="input-field pl-10" />
                  {addSearching && <Loader2 size={15} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" />}
                  {addHits.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                      {addHits.map(h => (
                        <button key={h.id} onClick={() => { setAddStudent(h); setAddHits([]); }}
                          className="w-full text-left px-4 py-2.5 hover:bg-primary-50 transition-colors border-b border-gray-50 last:border-0">
                          <p className="font-semibold text-sm text-primary-900">{h.name}</p>
                          <p className="text-xs text-gray-400">{h.nis} · {h.className}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {addClassFilter && addQuery.trim().length < 2 && addHits.length === 0 && !addSearching && (
                  <p className="text-sm text-gray-400 mt-1.5">Tidak ada siswa aktif di kelas ini.</p>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="label-field">Jenis Biaya</label>
            <Select value={addFeeTypeId} onChange={v => {
              setAddFeeTypeId(v);
              const ft = feeTypes.find(f => f.id === v);
              if (ft) setAddAmount(String(ft.defaultAmount));
            }} options={feeTypes.map(f => ({ value: f.id, label: `${f.name} (${formatRupiah(f.defaultAmount)})` }))} placeholder="— Pilih —" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-field">Jumlah (Rp)</label><input type="number" min={0} value={addAmount} onChange={e => setAddAmount(e.target.value)} className="input-field" /></div>
            <div><label className="label-field">Periode</label><MonthPicker value={addPeriod} onChange={setAddPeriod} /></div>
          </div>
          <div><label className="label-field">Jatuh Tempo (opsional)</label><DatePicker value={addDueDate} onChange={setAddDueDate} /></div>
        </div>
      </Modal>

      {/* Modal: Generate Massal */}
      <Modal open={genModal} onClose={() => setGenModal(false)} title="Generate Tagihan Massal" size="sm"
        footer={<>
          <button onClick={() => setGenModal(false)} className="btn-modal-cancel">Batal</button>
          <button onClick={submitGenerate} disabled={genSaving} className="btn-modal-save">
            {genSaving ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />} Generate
          </button>
        </>}>
        <div className="space-y-4">
          <div>
            <label className="label-field">Jenis Biaya</label>
            <Select value={genFeeTypeId} onChange={setGenFeeTypeId}
              options={feeTypes.map(f => ({ value: f.id, label: `${f.name} (${formatRupiah(f.defaultAmount)})` }))} placeholder="— Pilih —" />
          </div>
          <div>
            <label className="label-field">Periode</label>
            <MonthPicker value={genPeriod} onChange={setGenPeriod} />
          </div>
          <div>
            <label className="label-field">Kelas</label>
            <Select value={genClassId} onChange={setGenClassId}
              options={[{ value: "", label: "Semua Siswa Aktif" }, ...classes.map(c => ({ value: c.id, label: c.name }))]} placeholder="— Pilih —" />
          </div>
          <p className="text-xs text-gray-400">Siswa yang sudah punya tagihan jenis &amp; periode yang sama akan dilewati (tidak dobel).</p>
        </div>
      </Modal>

      {/* Modal: Edit / Tandai Lunas */}
      <Modal open={!!editInvoice} onClose={() => setEditInvoice(null)}
        title="Edit Tagihan"
        description={editInvoice ? `${editInvoice.student.user.name} — ${editInvoice.feeType.name} (${editInvoice.period})` : undefined}
        size="md"
        footer={<>
          <button onClick={() => setEditInvoice(null)} className="btn-modal-cancel">Batal</button>
          <button onClick={submitEdit} disabled={editSaving} className="btn-modal-save">
            {editSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Simpan
          </button>
        </>}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label-field">Jumlah Tagihan (Rp)</label><input type="number" min={0} value={editAmount} onChange={e => setEditAmount(e.target.value)} className="input-field" /></div>
            <div><label className="label-field">Jatuh Tempo</label><DatePicker value={editDueDate} onChange={setEditDueDate} /></div>
          </div>
          <div className="border-t border-gray-100 pt-4 grid grid-cols-2 gap-3">
            <div><label className="label-field">Dibayar (Rp)</label><input type="number" min={0} value={editPaidAmount} onChange={e => setEditPaidAmount(e.target.value)} className="input-field" /></div>
            <div><label className="label-field">Tanggal Bayar</label><DatePicker value={editPaidAt} onChange={setEditPaidAt} /></div>
          </div>
          <div>
            <label className="label-field">Metode Bayar</label>
            <Select value={editMethod} onChange={setEditMethod}
              options={[{ value: "Tunai", label: "Tunai" }, { value: "Transfer Bank", label: "Transfer Bank" }, { value: "Lainnya", label: "Lainnya" }]} placeholder="— Pilih (opsional) —" />
          </div>
          <div><label className="label-field">Catatan</label><textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={2} className="input-field" /></div>
        </div>
      </Modal>
    </div>
  );
}
