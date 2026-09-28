"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, BarChart3, Briefcase, Building2, ChevronRight, FileCheck, Gauge, GraduationCap, Loader2, Siren, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import { tautanJabatan, BASE_GURU } from "@/lib/rute-jabatan";
import BarisPintasan from "@/components/shared/BarisPintasan";

interface Ringkasan {
  semester: string;
  hariIni: {
    tanggal: string; libur: string | null; siswaAktif: number; tercatat: number; hadir: number; izin: number; sakit: number; alpha: number;
    persenHadir: number | null; kelasBelumAbsen: string[]; guruTercatat: number; guruTidakHadir: number; guruTerlambat: number;
    jadwal: number; jurnal: number; ujianBerlangsung: number; izinMenunggu: number;
  };
  keputusan: { raporSiapSah: number; mouAkanBerakhir: number };
  risiko: { tinggi: number; sedang: number; pantau: number; total: number } | null;
  tren: { label: string; persenHadir: number | null; pelanggaran: number }[];
  perJurusan: { nama: string; kode: string; siswa: number; persenHadir: number | null; rataNilai: number | null; persenTuntas: number | null; pelanggaran: number }[];
  pklByStatus: { ONGOING: number; COMPLETED: number; CANCELLED: number };
  topCompanies: { company: string; count: number }[];
}

const WARNA_HADIR = "#059669";
const WARNA_PELANGGARAN = "#dc2626";
const tanggalPanjang = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** DASHBOARD EKSEKUTIF KEPALA SEKOLAH (diperkaya 17 Sep 2026): kondisi hari ini, keputusan yang menunggu, siswa berisiko, tren 6 bulan,
 * dan perbandingan per jurusan. */
/** Dipakai portal GURU (pemegang jabatannya) dan portal ADMIN (superadmin, lewat grup menu
 * "Dashboard Jabatan") — keputusan user 19 September 2026: "superadmin sifatnya full akses ke
 * semuanya ... karena si superadmin bukan pegawai dan bukan guru di situ", jadi ia tidak boleh
 * dilempar ke shell portal guru untuk melihat dashboard ini. */
export default function KepalaSekolahDashboard({ basePath = BASE_GURU }: { basePath?: string }) {
  const [data, setData] = useState<Ringkasan | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/teacher/kepala-sekolah/summary", { cache: "no-store" })
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok || !d) setError(d?.error || "Gagal memuat data"); else setData(d); })
      .catch(() => setError("Gagal memuat data"));
  }, []);

  if (!data && !error) return <div className="p-6 lg:p-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  if (!data) return <div className="p-6 lg:p-8 text-center text-gray-400 py-20">{error}</div>;
  const h = data.hariIni;
  const totalPkl = data.pklByStatus.ONGOING + data.pklByStatus.COMPLETED + data.pklByStatus.CANCELLED;

  const pintasan = [
    { href: tautanJabatan(basePath, "kepala-sekolah/rapor"), label: "Pengesahan Rapor", ket: data.keputusan.raporSiapSah ? `${data.keputusan.raporSiapSah} kelas siap disahkan` : "Tidak ada yang menunggu", ikon: FileCheck, sorot: data.keputusan.raporSiapSah > 0 },
    { href: tautanJabatan(basePath, "peringatan-dini"), label: "Peringatan Dini Siswa", ket: data.risiko ? `${data.risiko.tinggi} risiko tinggi · ${data.risiko.sedang} sedang` : "Lihat siswa berisiko", ikon: Siren, sorot: (data.risiko?.tinggi ?? 0) > 0 },
    { href: tautanJabatan(basePath, "kepala-sekolah/mitra"), label: "Peta Kemitraan Industri", ket: data.keputusan.mouAkanBerakhir ? `${data.keputusan.mouAkanBerakhir} MoU berakhir ≤ 60 hari` : "MoU mitra aman", ikon: Building2, sorot: data.keputusan.mouAkanBerakhir > 0 },
    { href: tautanJabatan(basePath, "kinerja-pimpinan"), label: "Kinerja Guru & Pimpinan", ket: "Capaian indikator kinerja", ikon: BarChart3, sorot: false },
  ];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Gauge size={22} />} title="Dashboard Kepala Sekolah"
        description={`${tanggalPanjang(h.tanggal)} · Semester ${data.semester}`} />

      <div className="space-y-6">
        {h.libur && (
          <p className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">Hari ini libur: <strong>{h.libur}</strong>. Angka hari ini tidak diharapkan terisi.</p>
        )}
        <div className="kisi-kartu kisi-kartu-4">
          <StatTile ikon="centang" color="emerald" value={h.persenHadir === null ? "—" : `${h.persenHadir}%`} label="Kehadiran siswa hari ini"
            sublabel={`${h.tercatat}/${h.siswaAktif} tercatat · alpha ${h.alpha}`} />
          <StatTile ikon="kelas" color={h.kelasBelumAbsen.length ? "amber" : "blue"} value={h.kelasBelumAbsen.length} label="Kelas belum diabsen"
            sublabel={h.kelasBelumAbsen.slice(0, 3).join(", ") || "Semua kelas sudah"} sorot={h.kelasBelumAbsen.length > 0 && !h.libur} />
          <StatTile ikon="guru" color={h.guruTidakHadir ? "red" : "purple"} value={h.guruTidakHadir} label="Guru tidak hadir (catatan piket)"
            sublabel={`${h.guruTercatat} jam tercatat · terlambat ${h.guruTerlambat}`} />
          <StatTile ikon="jurnal" color="primary" value={`${h.jurnal}/${h.jadwal}`} label="Jurnal mengajar terisi hari ini"
            sublabel={`${h.ujianBerlangsung} ujian berlangsung · ${h.izinMenunggu} izin menunggu`} />
        </div>

        <BarisPintasan items={pintasan} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel p-5 min-w-0">
            <h3 className="font-heading font-semibold text-primary-900 text-sm mb-1 flex items-center gap-2"><TrendingUp size={15} className="text-emerald-600" /> Kehadiran siswa per bulan</h3>
            <p className="text-xs text-gray-500 mb-3">Persentase hadir dari seluruh catatan absensi, 6 bulan terakhir</p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={data.tren} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [v === null ? "—" : `${v}%`, "Kehadiran"]} cursor={{ fill: "#f5f6fa" }} />
                <Bar dataKey="persenHadir" radius={[4, 4, 0, 0]} maxBarSize={36} fill={WARNA_HADIR}>
                  <LabelList dataKey="persenHadir" position="top" formatter={(v: unknown) => (v === null || v === undefined ? "" : `${v}%`)} style={{ fontSize: 12, fill: "#374151" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel p-5 min-w-0">
            <h3 className="font-heading font-semibold text-primary-900 text-sm mb-1 flex items-center gap-2"><AlertTriangle size={15} className="text-red-600" /> Pelanggaran tercatat per bulan</h3>
            <p className="text-xs text-gray-500 mb-3">Jumlah catatan poin pelanggaran, 6 bulan terakhir</p>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={data.tren} margin={{ top: 18, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={{ stroke: "#e5e7eb" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => [v, "Pelanggaran"]} cursor={{ fill: "#f5f6fa" }} />
                <Bar dataKey="pelanggaran" radius={[4, 4, 0, 0]} maxBarSize={36} fill={WARNA_PELANGGARAN}>
                  <LabelList dataKey="pelanggaran" position="top" formatter={(v: unknown) => (v ? String(v) : "")} style={{ fontSize: 12, fill: "#374151" }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3.5">
            <GraduationCap size={16} className="text-primary-700" />
            <h3 className="font-heading font-semibold text-primary-900 text-sm">Perbandingan per jurusan</h3>
            <span className="ml-auto text-xs text-gray-500">Kehadiran & pelanggaran 30 hari · nilai semester {data.semester}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Jurusan</th><th className="text-right">Siswa aktif</th><th className="text-right">Kehadiran</th><th className="text-right">Rata-rata nilai</th><th className="text-right">Tuntas KKM</th><th className="text-right">Pelanggaran</th></tr></thead>
              <tbody>
                {data.perJurusan.map(j => (
                  <tr key={j.kode}>
                    <td><p className="font-medium text-primary-900">{j.kode}</p><p className="text-xs text-gray-500">{j.nama}</p></td>
                    <td className="text-right tabular-nums">{j.siswa}</td>
                    <td className="text-right tabular-nums">{j.persenHadir === null ? "—" : `${j.persenHadir}%`}</td>
                    <td className="text-right tabular-nums">{j.rataNilai ?? "—"}</td>
                    <td className={`text-right tabular-nums ${j.persenTuntas !== null && j.persenTuntas < 75 ? "font-semibold text-red-600" : ""}`}>{j.persenTuntas === null ? "—" : `${j.persenTuntas}%`}</td>
                    <td className="text-right tabular-nums">{j.pelanggaran}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-primary-900 text-sm mb-3 flex items-center gap-2"><Briefcase size={15} className="text-primary-700" /> Status PKL siswa</h3>
            {totalPkl === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada data PKL.</p> : (
              <div className="space-y-2.5">
                {([["ONGOING", "Sedang PKL", "bg-blue-500"], ["COMPLETED", "Selesai", "bg-emerald-500"], ["CANCELLED", "Dibatalkan", "bg-red-500"]] as const).map(([k, l, warna]) => (
                  <div key={k}>
                    <div className="flex justify-between text-sm"><span className="text-gray-600">{l}</span><span className="font-semibold tabular-nums text-primary-900">{data.pklByStatus[k]}</span></div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full ${warna}`} style={{ width: `${(data.pklByStatus[k] / totalPkl) * 100}%` }} /></div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel p-5">
            <h3 className="font-heading font-semibold text-primary-900 text-sm mb-3 flex items-center gap-2"><Building2 size={15} className="text-primary-700" /> Mitra PKL terbanyak</h3>
            {data.topCompanies.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada data perusahaan PKL.</p> : (
              <ul className="divide-y divide-gray-50">
                {data.topCompanies.map(c => (
                  <li key={c.company} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-gray-700">{c.company}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-primary-900">{c.count} siswa</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
