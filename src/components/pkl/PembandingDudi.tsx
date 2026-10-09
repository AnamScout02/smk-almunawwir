"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Scale, Loader2, Search } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import Select from "@/components/admin/Select";
import { BarisKembali } from "@/components/shared/TombolKembali";

type Baris = {
  id: string; nama: string; bidang: string | null; aktif: boolean; kuota: number | null; siswa: number; selesai: number;
  jurnalPersen: number | null; hadirPersen: number | null; nilai: number | null; masalah: number; pindah: number; monitoring: number;
  umpanBalik: number | null; jumlahUmpan: number; saran: "LANJUT" | "TINJAU" | "BELUM"; alasan: string[];
};
const SARAN = {
  LANJUT: { label: "Layak dilanjutkan", kelas: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  TINJAU: { label: "Perlu ditinjau", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  BELUM: { label: "Belum cukup data", kelas: "bg-gray-50 text-gray-500 border-gray-200" },
};
const persen = (n: number | null) => (n == null ? <span className="text-gray-300">—</span> : `${n}%`);

/** PEMBANDING ANTAR DUDI — angka tiap mitra berdampingan + saran berbasis aturan (dengan alasannya), untuk rapat evaluasi. */
export default function PembandingDudi() {
  const [data, setData] = useState<Baris[] | null>(null);
  const [cari, setCari] = useState("");
  const [saring, setSaring] = useState("DIPAKAI");
  const [urut, setUrut] = useState("siswa");
  useEffect(() => { fetch("/api/pkl/pembanding").then(r => r.json()).then(d => setData(d.dudi ?? [])).catch(() => setData([])); }, []);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const v = (data ?? []).filter(d => (!q || `${d.nama} ${d.bidang ?? ""}`.toLowerCase().includes(q)) &&
      (saring === "" || (saring === "DIPAKAI" ? d.siswa > 0 : d.saran === saring)));
    const kunci = (d: Baris) => (urut === "nilai" ? d.nilai ?? -1 : urut === "jurnal" ? d.jurnalPersen ?? -1 : urut === "masalah" ? d.masalah + d.pindah : d.siswa);
    return [...v].sort((a, b) => kunci(b) - kunci(a) || a.nama.localeCompare(b.nama, "id"));
  }, [data, cari, saring, urut]);
  if (!data) return <div className="p-6 lg:p-8 pt-16 lg:pt-8 flex items-center justify-center min-h-[60vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Scale size={22} />} title="Pembanding Antar DUDI" description="Kehadiran, jurnal, nilai, masalah, dan umpan balik tiap mitra berdampingan" />
      <BarisKembali href="/pusat-pkl/dudi" />
      <div className="space-y-6">
        <div className="kisi-kartu kisi-kartu-3">
          <StatTile value={data.filter(d => d.saran === "LANJUT").length} label="Layak dilanjutkan" icon={Scale} color="emerald" />
          <StatTile value={data.filter(d => d.saran === "TINJAU").length} label="Perlu ditinjau" icon={Scale} color="amber" sorot={data.some(d => d.saran === "TINJAU")} />
          <StatTile value={data.filter(d => d.saran === "BELUM").length} label="Belum cukup data" icon={Scale} color="gray" />
        </div>
        <div className="baris-alat">
          <div className="alat-cari">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input className="input-field pl-10" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari DUDI atau bidang..." />
          </div>
          <div className="alat-saring"><Select value={saring} onChange={setSaring} options={[{ value: "DIPAKAI", label: "Yang pernah ditempati" }, { value: "", label: "Semua DUDI" }, ...Object.entries(SARAN).map(([value, s]) => ({ value, label: s.label }))]} /></div>
          <div className="alat-saring"><Select value={urut} onChange={setUrut} options={[{ value: "siswa", label: "Urut: jumlah siswa" }, { value: "nilai", label: "Urut: nilai industri" }, { value: "jurnal", label: "Urut: jurnal terisi" }, { value: "masalah", label: "Urut: masalah & pindah" }]} /></div>
        </div>
        <div className="panel overflow-hidden">
          {tampil.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Belum ada DUDI yang ditempati siswa.</p> : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th className="w-10">No</th><th>DUDI</th><th className="text-right">Siswa</th><th className="text-right">Jurnal terisi</th><th className="text-right">Kehadiran</th><th className="text-right">Nilai industri</th><th className="text-right">Masalah</th><th className="text-right">Pindah keluar</th><th className="text-right">Monitoring</th><th className="text-right">Umpan balik</th><th>Saran</th></tr></thead>
                <tbody>
                  {tampil.map((d, i) => (
                    <tr key={d.id} className={d.aktif ? "" : "opacity-60"}>
                      <td className="angka">{i + 1}</td>
                      <td><Link href={`/pusat-pkl/dudi?buka=${d.id}`} className="font-medium text-primary-900 hover:underline">{d.nama}</Link><span className="block text-xs text-gray-400">{d.bidang || "bidang belum diisi"}{d.aktif ? "" : " · nonaktif"}</span></td>
                      <td className="angka text-right">{d.siswa}{d.selesai > 0 && <span className="block text-xs text-gray-400">{d.selesai} selesai</span>}</td>
                      <td className="angka text-right">{persen(d.jurnalPersen)}</td>
                      <td className="angka text-right">{persen(d.hadirPersen)}</td>
                      <td className="angka text-right">{d.nilai ?? <span className="text-gray-300">—</span>}</td>
                      <td className={`angka text-right ${d.masalah ? "text-amber-700" : ""}`}>{d.masalah}</td>
                      <td className={`angka text-right ${d.pindah ? "text-amber-700" : ""}`}>{d.pindah}</td>
                      <td className="angka text-right">{d.monitoring}</td>
                      <td className="angka text-right">{d.umpanBalik != null ? `${d.umpanBalik} / 5` : <span className="text-gray-300">—</span>}{d.jumlahUmpan > 0 && <span className="block text-xs text-gray-400">{d.jumlahUmpan} siswa</span>}</td>
                      <td><span className={`status-badge ${SARAN[d.saran].kelas}`}>{SARAN[d.saran].label}</span>{d.alasan.length > 0 && <span className="mt-1 block text-xs text-gray-500">{d.alasan.join(" · ")}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t border-gray-100 px-5 py-3 text-xs text-gray-500">
            Jurnal terisi = jumlah jurnal dibagi hari kerja (Senin–Sabtu) yang sudah dijalani. Kehadiran dari presensi PKL yang tercatat. Saran &ldquo;perlu ditinjau&rdquo; muncul bila ada
            2 laporan masalah atau lebih, siswa pindah keluar, nilai industri di bawah 70, jurnal terisi di bawah 40%, atau kehadiran di bawah 75% — itu bahan rapat, bukan keputusan.
          </p>
        </div>
      </div>
    </div>
  );
}
