"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Repeat, Printer, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import Select from "@/components/admin/Select";
import StatTile from "@/components/admin/StatTile";

interface MutasiMasuk {
  id: string; tanggal: string; nis: string; nama: string; kelas: string; jurusan: string;
  asal: string; asalSekolah: string; asalNis: string; asalAlamat: string; kelasAsal: string;
  suratTanggal: string; suratNomor: string; keterangan: string;
}
interface MutasiKeluar {
  id: string; tipe: string; tanggal: string; nis: string; nama: string; kelas: string; jurusan: string;
  tujuan: string; alasan: string; suratTanggal: string; suratNomor: string;
}
interface RekapRow { grade: number; label: string; L: number; P: number; jumlah: number }
interface TahunAjaran { id: string; name: string; isActive: boolean }

function formatTgl(d: string) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });
}

const BULAN_LABEL = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const STATUS_LABEL: Record<string, string> = {
  PINDAH: "Pindah Sekolah", KELUAR: "Keluar", LULUS: "Lulus",
};
const STATUS_COLOR: Record<string, string> = {
  PINDAH: "bg-amber-50 text-amber-700 border border-amber-200",
  KELUAR: "bg-red-50 text-red-600 border border-red-200",
  LULUS: "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

/** Overlay garis silang "NIHIL" di atas tabel cetak resmi saat tidak ada mutasi bulan itu —
 * baris & kolom kosong tetap tercetak bergaris seperti form fisik, garis silang cuma lapisan
 * di atasnya (absolute, tidak ganggu border tabel) menandakan sengaja kosong. */
function NihilOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="absolute inset-0" style={{
        backgroundImage: [
          "linear-gradient(to top right, transparent calc(50% - 1px), #1f2937 50%, transparent calc(50% + 1px))",
          "linear-gradient(to bottom right, transparent calc(50% - 1px), #1f2937 50%, transparent calc(50% + 1px))",
        ].join(", "),
      }} />
      <span className="relative z-10 bg-white px-3 text-xs font-bold uppercase tracking-wide">Nihil</span>
    </div>
  );
}

export default function BukuMutasiPage() {
  const now = new Date();
  const [tab, setTab] = useState<"MASUK" | "KELUAR">("MASUK");
  const [tahunAjaranList, setTahunAjaranList] = useState<TahunAjaran[]>([]);
  const [tahunPelajaran, setTahunPelajaran] = useState("");
  const [bulan, setBulan] = useState(String(now.getMonth() + 1));
  const [masuk, setMasuk] = useState<MutasiMasuk[]>([]);
  const [keluar, setKeluar] = useState<MutasiKeluar[]>([]);
  const [principalName, setPrincipalName] = useState("");
  const [rekap, setRekap] = useState<RekapRow[]>([]);
  const [totalAktif, setTotalAktif] = useState(0);
  const [totalAwalBulan, setTotalAwalBulan] = useState(0);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [loading, setLoading] = useState(true);

  // Buku Mutasi mengikuti Tahun Pelajaran aktif — muat daftar tahun ajaran sekali, default ke yang aktif.
  useEffect(() => {
    fetch("/api/admin/tahun-ajaran").then(r => r.json()).then((d: TahunAjaran[]) => {
      if (!Array.isArray(d)) return;
      setTahunAjaranList(d);
      const active = d.find(y => y.isActive);
      if (active) setTahunPelajaran(active.name);
      else if (d[0]) setTahunPelajaran(d[0].name);
    }).catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    if (!tahunPelajaran) return;
    setLoading(true);
    const res = await fetch(`/api/admin/buku-mutasi?tahunPelajaran=${encodeURIComponent(tahunPelajaran)}&bulan=${bulan}`);
    const d = await res.json();
    setMasuk(Array.isArray(d.masuk) ? d.masuk : []);
    setKeluar(Array.isArray(d.keluar) ? d.keluar : []);
    setPrincipalName(d.principalName ?? "");
    setRekap(Array.isArray(d.rekap) ? d.rekap : []);
    setTotalAktif(d.totalAktif ?? 0);
    setTotalAwalBulan(d.totalAwalBulan ?? 0);
    if (d.tahun) setTahun(d.tahun);
    setLoading(false);
  }, [tahunPelajaran, bulan]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const bulanLabel = BULAN_LABEL[parseInt(bulan) - 1];
  const totalRekap = rekap.reduce((a, r) => a + r.jumlah, 0);
  const totalL = rekap.reduce((a, r) => a + r.L, 0);
  const totalP = rekap.reduce((a, r) => a + r.P, 0);
  const formatPct = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  const pctMasuk = totalAwalBulan > 0 ? formatPct((masuk.length / totalAwalBulan) * 100) : "0";
  const pctKeluar = totalAwalBulan > 0 ? formatPct((keluar.length / totalAwalBulan) * 100) : "0";

  const cellCls = "border border-gray-800 px-2 py-1.5 text-[11px]";
  const thCls = "border border-gray-800 px-2 py-1.5 text-[11px] font-bold text-center";

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="print:hidden">
        <PageHeader
          icon={<Repeat size={22} />}
          title="Buku Mutasi Siswa"
          description="Rekap siswa masuk dan keluar per bulan"
        />
        {/* Filter & cetak di baris terpisah (bukan di actions PageHeader) — actions berbagi baris
            dengan judul, jadi kalau diisi banyak elemen judulnya kepepet & wrap. */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <Select className="w-auto" value={bulan} onChange={setBulan}
            options={BULAN_LABEL.map((b, i) => ({ value: String(i + 1), label: b }))} />
          <Select className="w-auto" value={tahunPelajaran} onChange={setTahunPelajaran}
            options={tahunAjaranList.map(y => ({ value: y.name, label: `${y.name}${y.isActive ? " (Aktif)" : ""}` }))}
            placeholder="Pilih tahun ajaran" />
          <button onClick={() => window.print()} className="btn-gold flex items-center gap-2 text-sm sm:ml-auto">
            <Printer size={15} /> Cetak
          </button>
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="grid grid-cols-2 gap-4 mb-6 print:hidden">
          <StatTile color="blue" icon={ArrowDownCircle} value={masuk.length} label="Siswa Masuk" sublabel={`${bulanLabel} ${tahun}`} />
          <StatTile color="red" icon={ArrowUpCircle} value={keluar.length} label="Siswa Keluar" sublabel={`${bulanLabel} ${tahun}`} />
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
        <div className="text-center py-12 text-gray-400 print:hidden">Memuat data...</div>
      ) : tab === "MASUK" ? (
        <>
          {/* Tabel on-screen */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    {["No", "Tanggal", "NIS", "Nama Siswa", "Kelas", "Asal Sekolah", "No. Induk Asal", "Kelas Asal", "Alamat Asal", "No. Surat"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {masuk.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-10 text-gray-400">Tidak ada siswa masuk bulan {bulanLabel} {tahun}</td></tr>
                  ) : masuk.map((s, i) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatTgl(s.tanggal)}</td>
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-gray-600">{s.nis}</td>
                      <td className="px-5 py-3.5 font-semibold text-primary-900">{s.nama}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.kelas}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.asalSekolah}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.asalNis}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.kelasAsal}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.asalAlamat}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.suratNomor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {masuk.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">Total: {masuk.length} siswa masuk</div>
            )}
          </div>

          {/* Cetak resmi — Masuk */}
          <div className="hidden print:block">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold uppercase">Data Mutasi Siswa Yang Masuk</h2>
              <p className="text-xl font-bold uppercase">SMK Al Munawwir IIBS</p>
              <p className="text-sm mt-1">Bulan: {bulanLabel} &nbsp;&nbsp; Tahun: {tahun}</p>
            </div>
            <div className="relative mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls} rowSpan={2}>No</th>
                  <th className={thCls} rowSpan={2}>Nama Siswa</th>
                  <th className={thCls} rowSpan={2}>Asal Sekolah</th>
                  <th className={thCls} rowSpan={2}>Nomor Induk Asal</th>
                  <th className={thCls} rowSpan={2}>Kelas Asal</th>
                  <th className={thCls} rowSpan={2}>Alamat/Provinsi Asal</th>
                  <th className={thCls} rowSpan={2}>Kelas</th>
                  <th className={thCls} rowSpan={2}>Nomor Induk Baru</th>
                  <th className={thCls} colSpan={2}>Tanggal dan Nomor Surat Pindah</th>
                </tr>
                <tr>
                  <th className={thCls}>Tanggal</th>
                  <th className={thCls}>Nomor</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(masuk.length, 10) }).map((_, i) => {
                  const s = masuk[i];
                  return (
                    <tr key={i}>
                      <td className={`${cellCls} text-center`}>{i + 1}</td>
                      <td className={cellCls}>{s?.nama ?? ""}</td>
                      <td className={cellCls}>{s?.asalSekolah && s.asalSekolah !== "-" ? s.asalSekolah : ""}</td>
                      <td className={cellCls}>{s?.asalNis && s.asalNis !== "-" ? s.asalNis : ""}</td>
                      <td className={cellCls}>{s?.kelasAsal && s.kelasAsal !== "-" ? s.kelasAsal : ""}</td>
                      <td className={cellCls}>{s?.asalAlamat && s.asalAlamat !== "-" ? s.asalAlamat : ""}</td>
                      <td className={cellCls}>{s?.kelas ?? ""}</td>
                      <td className={cellCls}>{s?.nis ?? ""}</td>
                      <td className={cellCls}>{s ? formatTgl(s.suratTanggal) : ""}</td>
                      <td className={cellCls}>{s?.suratNomor && s.suratNomor !== "-" ? s.suratNomor : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {masuk.length === 0 && <NihilOverlay />}
            </div>

            <p className="font-bold underline mb-2 text-sm">Rekapitulasi Keadaan Siswa</p>
            <p className="text-sm mb-2">Keadaan Siswa Bulan: {bulanLabel} &nbsp;&nbsp; Tahun: {tahun}</p>
            <table className="border-collapse" style={{ width: 260, tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th className={thCls} style={{ width: 80 }}>Kelas</th>
                  <th className={thCls} style={{ width: 60 }}>L</th>
                  <th className={thCls} style={{ width: 60 }}>P</th>
                  <th className={thCls} style={{ width: 60 }}>Jumlah</th>
                </tr>
              </thead>
              <tbody>
                {rekap.map(r => (
                  <tr key={r.grade}>
                    <td className={`${cellCls} text-center`}>{r.label}</td>
                    <td className={`${cellCls} text-center`}>{r.L}</td>
                    <td className={`${cellCls} text-center`}>{r.P}</td>
                    <td className={`${cellCls} text-center`}>{r.jumlah}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className={`${cellCls} text-center`}>Jumlah</td>
                  <td className={`${cellCls} text-center`}>{totalL}</td>
                  <td className={`${cellCls} text-center`}>{totalP}</td>
                  <td className={`${cellCls} text-center`}>{totalRekap}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          {/* Tabel on-screen */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden print:hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-primary-100" style={{ background: "linear-gradient(135deg, rgba(15,26,69,0.05) 0%, rgba(27,43,107,0.03) 100%)" }}>
                    {["No", "Tanggal", "NIS", "Nama Siswa", "Kelas", "Status", "Pindah Ke", "No. Surat", "Alasan"].map(h => (
                      <th key={h} className="text-left px-5 py-3 text-[0.68rem] font-bold uppercase tracking-wide text-primary-500/70 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {keluar.length === 0 ? (
                    <tr><td colSpan={9} className="text-center py-10 text-gray-400">Tidak ada siswa keluar bulan {bulanLabel} {tahun}</td></tr>
                  ) : keluar.map((s, i) => (
                    <tr key={s.id} className="border-b border-gray-50 last:border-0 hover:bg-primary-50/30 transition-colors">
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs whitespace-nowrap">{formatTgl(s.tanggal)}</td>
                      <td className="px-5 py-3.5 font-mono text-xs font-medium text-gray-600">{s.nis}</td>
                      <td className="px-5 py-3.5 font-semibold text-primary-900">{s.nama}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.kelas}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_COLOR[s.tipe] ?? "bg-gray-50 text-gray-600 border border-gray-200"}`}>
                          {STATUS_LABEL[s.tipe] ?? s.tipe}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.tujuan}</td>
                      <td className="px-5 py-3.5 text-gray-500 text-xs">{s.suratNomor}</td>
                      <td className="px-5 py-3.5 text-gray-400 text-xs">{s.alasan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {keluar.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-50 text-xs text-gray-400">Total: {keluar.length} siswa keluar</div>
            )}
          </div>

          {/* Cetak resmi — Keluar */}
          <div className="hidden print:block">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold uppercase">Data Mutasi Siswa Yang Keluar</h2>
              <p className="text-xl font-bold uppercase">SMK Al Munawwir IIBS</p>
              <p className="text-sm mt-1">Bulan: {bulanLabel} &nbsp;&nbsp; Tahun: {tahun}</p>
            </div>
            <div className="relative mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={thCls} rowSpan={2}>No</th>
                  <th className={thCls} rowSpan={2}>Nama Siswa</th>
                  <th className={thCls} rowSpan={2}>Kelas</th>
                  <th className={thCls} rowSpan={2}>Nomor Induk</th>
                  <th className={thCls} rowSpan={2}>Pindah Ke</th>
                  <th className={thCls} colSpan={2}>Tanggal dan Nomor Surat Pindah</th>
                </tr>
                <tr>
                  <th className={thCls}>Tanggal</th>
                  <th className={thCls}>Nomor</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(keluar.length, 10) }).map((_, i) => {
                  const s = keluar[i];
                  return (
                    <tr key={i}>
                      <td className={`${cellCls} text-center`}>{i + 1}</td>
                      <td className={cellCls}>{s?.nama ?? ""}</td>
                      <td className={cellCls}>{s?.kelas ?? ""}</td>
                      <td className={cellCls}>{s?.nis ?? ""}</td>
                      <td className={cellCls}>{s?.tujuan && s.tujuan !== "-" ? s.tujuan : ""}</td>
                      <td className={cellCls}>{s ? formatTgl(s.suratTanggal) : ""}</td>
                      <td className={cellCls}>{s?.suratNomor && s.suratNomor !== "-" ? s.suratNomor : ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {keluar.length === 0 && <NihilOverlay />}
            </div>

            <div className="mb-5 text-sm underline-offset-2">
              <p className="font-bold underline mb-2">Catatan</p>
              <p>Jumlah Siswa yang diterima : {masuk.length} Orang = {pctMasuk}%</p>
              <p>Jumlah Siswa yang keluar &nbsp;: {keluar.length} Orang = {pctKeluar}%</p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-8 text-sm text-center mt-8">
              <div className="min-w-0">
                <p className="mb-8">Mengetahui,<br />Kepala SMK Al Munawwir IIBS</p>
                <p className="font-semibold underline break-words">{principalName || "( _____________ )"}</p>
              </div>
              <div className="min-w-0">
                <p className="mb-8">Yang membuat,<br />Tenaga Administrasi Sekolah</p>
                <p className="font-semibold break-words">( _____________ )</p>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 1.2cm; }
        }
      `}</style>
    </div>
  );
}
