"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Repeat, Printer, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";

interface MutasiMasuk {
  id: string; tipe: "MASUK"; tanggal: string;
  nis: string; nama: string; kelas: string; jurusan: string;
  asal: string; keterangan: string;
}
interface MutasiKeluar {
  id: string; tipe: string; tanggal: string;
  nis: string; nama: string; kelas: string; jurusan: string;
  tujuan: string; alasan: string;
}

function formatTgl(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  PINDAH: "Pindah Sekolah", KELUAR: "Keluar", LULUS: "Lulus",
};
const STATUS_COLOR: Record<string, string> = {
  PINDAH: "bg-amber-50 text-amber-700 border border-amber-200",
  KELUAR: "bg-red-50 text-red-600 border border-red-200",
  LULUS: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

export default function BukuMutasiPage() {
  const [tab, setTab] = useState<"MASUK" | "KELUAR">("MASUK");
  const [tahun, setTahun] = useState(new Date().getFullYear().toString());
  const [masuk, setMasuk] = useState<MutasiMasuk[]>([]);
  const [keluar, setKeluar] = useState<MutasiKeluar[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/buku-mutasi?tahun=${tahun}`);
    const d = await res.json();
    setMasuk(Array.isArray(d.masuk) ? d.masuk : []);
    setKeluar(Array.isArray(d.keluar) ? d.keluar : []);
    setLoading(false);
  }, [tahun]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const yearOpts = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader
        icon={<Repeat size={22} />}
        title="Buku Mutasi Siswa"
        description="Rekap siswa masuk dan keluar per tahun ajaran"
        actions={
          <div className="flex items-center gap-3 print:hidden">
            <Select
              className="w-auto"
              value={tahun}
              onChange={v => setTahun(v)}
              options={yearOpts.map(y => ({ value: String(y), label: `${y}/${y+1}` }))}
            />
            <button onClick={() => window.print()}
              className="btn-gold flex items-center gap-2 text-sm">
              <Printer size={15} /> Cetak
            </button>
          </div>
        }
      />

      {/* Print header */}
      <div className="hidden print:block mb-6 text-center border-b pb-4">
        <h2 className="text-xl font-bold">BUKU MUTASI SISWA</h2>
        <p className="text-base">SMK Al Munawwir IIBS</p>
        <p className="text-sm">Tahun Ajaran {tahun}/{parseInt(tahun)+1}</p>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 mb-6 print:hidden">
          <StatTile color="blue" value={masuk.length} label="Siswa Masuk" sublabel={`Tahun ${tahun}`} />
          <StatTile color="red" value={keluar.length} label="Siswa Keluar" sublabel={`Tahun ${tahun}`} />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5 print:hidden">
        {(["MASUK", "KELUAR"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-white shadow text-primary-700" : "text-gray-500 hover:text-gray-700"}`}>
            {t === "MASUK" ? <ArrowDownCircle size={15} /> : <ArrowUpCircle size={15} />}
            Siswa {t === "MASUK" ? "Masuk" : "Keluar"}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${t === "MASUK" ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-red-50 text-red-600 border-red-200"}`}>
              {t === "MASUK" ? masuk.length : keluar.length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Memuat data...</div>
      ) : tab === "MASUK" ? (
        <>
          {/* Print Masuk Header */}
          <div className="hidden print:block mb-3">
            <h3 className="font-bold text-base">DATA SISWA MASUK TAHUN {tahun}</h3>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border-0 print:shadow-none">
            <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm print:text-xs">
              <thead className="print:hidden">
                <tr className="border-b border-primary-100"
                  style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  {["No","Tanggal","NIS","Nama Siswa","Kelas","Jurusan","Asal Sekolah","Keterangan"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {masuk.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-gray-400">Tidak ada siswa masuk tahun {tahun}</td></tr>
                ) : masuk.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{i+1}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatTgl(s.tanggal)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-gray-600">{s.nis}</td>
                    <td className="px-5 py-3.5 font-semibold text-primary-900">{s.nama}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{s.kelas}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{s.jurusan}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{s.asal}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{s.keterangan || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {masuk.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                Total: {masuk.length} siswa masuk
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Print Keluar Header */}
          <div className="hidden print:block mb-3">
            <h3 className="font-bold text-base">DATA SISWA KELUAR TAHUN {tahun}</h3>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:border-0 print:shadow-none">
            <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm print:text-xs">
              <thead className="print:hidden">
                <tr className="border-b border-primary-100"
                  style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                  {["No","Tanggal","NIS","Nama Siswa","Kelas","Jurusan","Status","Pindah Ke","Alasan"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {keluar.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-10 text-gray-400">Tidak ada siswa keluar tahun {tahun}</td></tr>
                ) : keluar.map((s, i) => (
                  <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{i+1}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatTgl(s.tanggal)}</td>
                    <td className="px-5 py-3.5 font-mono text-xs font-medium text-gray-600">{s.nis}</td>
                    <td className="px-5 py-3.5 font-semibold text-primary-900">{s.nama}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{s.kelas}</td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{s.jurusan}</td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[s.tipe] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                        {STATUS_LABEL[s.tipe] ?? s.tipe}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 text-xs">{s.tujuan}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{s.alasan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {keluar.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">
                Total: {keluar.length} siswa keluar
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
