"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart2, Search, Loader2, Download, Printer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import EmptyState from "@/components/admin/EmptyState";
import DatePicker from "@/components/shared/DatePicker";
import { formatRupiah } from "@/lib/currency";

interface FeeType { id: string; name: string }
interface ClassOption { id: string; name: string }
interface InvoiceRow {
  id: string; period: string; amount: number; paidAmount: number;
  paidAt: string | null; dueDate: string | null; paymentMethod: string | null;
  student: { id: string; nis: string; user: { name: string }; class: { id: string; name: string } | null };
  feeType: { id: string; name: string };
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function monthStartISO(): string { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }

/** Halaman "Laporan Penagihan" — portal Bendahara (`/dashboard/bendahara/laporan`). Menggabungkan
 * 2 fitur mirip yang dilihat di referensi BRI Smart Billing: "Riwayat Pembayaran" (tab Sudah
 * Terbayar, filter Tanggal Bayar) + "Laporan Penagihan" (tab Belum Terbayar, filter Jatuh Tempo)
 * — satu halaman, bukan dua, supaya tidak duplikasi UI utk data yang sama (Invoice). Data
 * di-load SEKALI (pola "load semua + filter di client", §5.6 DESIGN_SYSTEM — dataset per sekolah
 * kecil), filter tanggal/kelas/jenis biaya diterapkan di client. */
export default function LaporanPenagihanManager() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"belum" | "sudah">("belum");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("ALL");
  const [feeTypeId, setFeeTypeId] = useState("ALL");
  const [dateFrom, setDateFrom] = useState(monthStartISO());
  const [dateTo, setDateTo] = useState(todayISO());

  useEffect(() => {
    setLoading(true);
    fetch("/api/bendahara/invoices").then(r => r.json()).then(d => setInvoices(Array.isArray(d) ? d : [])).catch(() => {}).finally(() => setLoading(false));
    fetch("/api/bendahara/classes").then(r => r.json()).then(d => setClasses(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/bendahara/fee-types").then(r => r.json()).then(d => setFeeTypes(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter(inv => {
      if (q && !inv.student.user.name.toLowerCase().includes(q) && !inv.student.nis.includes(q)) return false;
      if (classId !== "ALL" && inv.student.class?.id !== classId) return false;
      if (feeTypeId !== "ALL" && inv.feeType.id !== feeTypeId) return false;
      const belumLunas = inv.paidAmount < inv.amount;
      if (tab === "belum") {
        if (!belumLunas) return false;
        if (dateFrom && (!inv.dueDate || inv.dueDate.slice(0, 10) < dateFrom)) return false;
        if (dateTo && (!inv.dueDate || inv.dueDate.slice(0, 10) > dateTo)) return false;
      } else {
        if (belumLunas) return false;
        if (dateFrom && (!inv.paidAt || inv.paidAt.slice(0, 10) < dateFrom)) return false;
        if (dateTo && (!inv.paidAt || inv.paidAt.slice(0, 10) > dateTo)) return false;
      }
      return true;
    });
  }, [invoices, search, classId, feeTypeId, tab, dateFrom, dateTo]);

  const totalNominal = tab === "belum"
    ? filtered.reduce((a, inv) => a + (inv.amount - inv.paidAmount), 0)
    : filtered.reduce((a, inv) => a + inv.paidAmount, 0);

  const exportParams = new URLSearchParams();
  if (classId !== "ALL") exportParams.set("classId", classId);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BarChart2 size={22} />} title="Laporan Penagihan" description="Rekap tagihan belum terbayar & riwayat pembayaran yang sudah masuk" />

      <div className="flex gap-2 mb-5">
        {([["belum", "Belum Terbayar"], ["sudah", "Sudah Terbayar"]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2.5 rounded-xl transition ${tab === v ? "bg-primary-900 text-white" : "bg-gray-50 text-gray-500 hover:bg-gray-100"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="baris-alat items-end mb-5">
        <div className="alat-cari">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama atau NIS..." className="input-field pl-10" />
        </div>
        <div className="alat-saring">
          <label className="label-field">Kelas</label>
          <Select value={classId} onChange={setClassId} options={[{ value: "ALL", label: "Semua Kelas" }, ...classes.map(c => ({ value: c.id, label: c.name }))]} />
        </div>
        <div className="alat-saring">
          <label className="label-field">Jenis Biaya</label>
          <Select value={feeTypeId} onChange={setFeeTypeId} options={[{ value: "ALL", label: "Semua Jenis Biaya" }, ...feeTypes.map(f => ({ value: f.id, label: f.name }))]} />
        </div>
        <div className="alat-saring">
          <label className="label-field">{tab === "belum" ? "Jatuh Tempo Dari" : "Dibayar Dari"}</label>
          <DatePicker value={dateFrom} onChange={setDateFrom} />
        </div>
        <div className="alat-saring">
          <label className="label-field">{tab === "belum" ? "Jatuh Tempo Sampai" : "Dibayar Sampai"}</label>
          <DatePicker value={dateTo} onChange={setDateTo} />
        </div>
        <div className="alat-aksi">
          <a href={`/api/bendahara/export?${exportParams.toString()}`}
            className="btn-modal-cancel">
            <Download size={15} /> Unduh Excel
          </a>
        </div>
      </div>

      <div className="panel p-4 mb-5 flex items-center justify-between text-sm">
        <span className="text-gray-500">Total Data: <strong className="text-primary-900">{filtered.length}</strong></span>
        <span className="text-gray-500">Total Nominal: <strong className={tab === "belum" ? "text-red-600" : "text-emerald-700"}>{formatRupiah(totalNominal)}</strong></span>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-primary-500" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={BarChart2} title="Tidak Ada Data" description="Coba ubah filter tanggal, kelas, atau jenis biaya." />
      ) : (
        <div className="panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{tab === "belum" ? "Jatuh Tempo" : "Tanggal Bayar"}</th>
                  <th>Siswa</th><th>Kelas</th><th>Jenis Biaya</th>
                  {tab === "sudah" && <th>Metode</th>}
                  <th className="text-right">{tab === "belum" ? "Sisa Tagihan" : "Nominal"}</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv => (
                  <tr key={inv.id}>
                    <td>
                      {tab === "belum"
                        ? (inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—")
                        : (inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) : "—")}
                    </td>
                    <td>
                      <p className="font-semibold text-primary-900">{inv.student.user.name}</p>
                      <p className="text-xs text-gray-400">{inv.student.nis}</p>
                    </td>
                    <td>{inv.student.class?.name ?? "—"}</td>
                    <td>{inv.feeType.name}</td>
                    {tab === "sudah" && <td>{inv.paymentMethod ?? "—"}</td>}
                    <td className="text-right font-semibold">{formatRupiah(tab === "belum" ? inv.amount - inv.paidAmount : inv.paidAmount)}</td>
                    <td className="text-right">
                      <Link href={`/dashboard/bendahara/tagihan/${inv.id}/cetak`} title="Cetak Kwitansi"
                        className="inline-flex p-1.5 text-gray-400 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors">
                        <Printer size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
