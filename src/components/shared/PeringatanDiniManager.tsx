"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AlertOctagon, CalendarX2, Eye, HeartHandshake, Info, Loader2, Search, ShieldAlert, Siren, Users } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import Select from "@/components/admin/Select";

type Tingkat = "TINGGI" | "SEDANG" | "PANTAU";
interface Baris {
  studentId: string; nis: string; nama: string; kelas: string; skor: number; tingkat: Tingkat; alasan: string[];
  alpha30: number; alphaBeruntun: number; persenHadir: number | null; poinBersih: number; levelPoin: string;
  rataNilai: number | null; nilaiTurun: number | null; tugasTerlewat: number; ujianTerlewat: number;
}
interface Data {
  semester: string; cakupanAkses: string; jumlahSiswa: number; baris: Baris[];
  ringkas: { tinggi: number; sedang: number; pantau: number };
  cakupan: { hariAbsensi: number; nilai: number; tugasBertenggat: number; ujianBerakhir: number };
}

const GAYA: Record<Tingkat, { label: string; kelas: string }> = {
  TINGGI: { label: "Tinggi", kelas: "bg-red-50 text-red-600 border-red-200" },
  SEDANG: { label: "Sedang", kelas: "bg-amber-50 text-amber-700 border-amber-200" },
  PANTAU: { label: "Pantau", kelas: "bg-blue-50 text-blue-700 border-blue-200" },
};

/** Halaman Peringatan Dini Siswa — dipakai Dashboard BK, wali kelas/Wakasek Kesiswaan, dan admin. Cakupan data
 * ditentukan server (/api/peringatan-dini), bukan oleh halaman. */
/** `varian="bk"`: ikon Dashboard BK. Ikon dipilih DI SINI (klien) — halaman server tidak mengoper elemen ikon (CLAUDE.md #35). */
export default function PeringatanDiniManager({ judul = "Peringatan Dini Siswa", varian = "peringatan" }: { judul?: string; varian?: "peringatan" | "bk" }) {
  const ikon = varian === "bk" ? <HeartHandshake size={22} /> : <Siren size={22} />;
  const [data, setData] = useState<Data | null>(null);
  const [galat, setGalat] = useState("");
  const [cari, setCari] = useState("");
  const [tingkat, setTingkat] = useState("SEMUA");
  const [kelas, setKelas] = useState("SEMUA");

  useEffect(() => {
    fetch("/api/peringatan-dini")
      .then(async r => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.error ?? "Gagal memuat data."); return d; })
      .then(setData)
      .catch(e => setGalat(e.message));
  }, []);

  const daftarKelas = useMemo(() => [...new Set((data?.baris ?? []).map(b => b.kelas))].sort(), [data]);
  const tampil = useMemo(() => (data?.baris ?? []).filter(b =>
    (tingkat === "SEMUA" || b.tingkat === tingkat) &&
    (kelas === "SEMUA" || b.kelas === kelas) &&
    (!cari.trim() || `${b.nama} ${b.nis}`.toLowerCase().includes(cari.trim().toLowerCase()))), [data, tingkat, kelas, cari]);

  const catatanData = data ? [
    data.cakupan.nilai === 0 && "nilai semester ini belum diinput",
    data.cakupan.tugasBertenggat === 0 && "belum ada tugas online bertenggat 30 hari terakhir",
    data.cakupan.ujianBerakhir === 0 && "belum ada ujian online yang berakhir 30 hari terakhir",
  ].filter(Boolean) as string[] : [];

  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={ikon} title={judul}
        description={data ? `${data.cakupanAkses} · ${data.semester} · data 30 hari terakhir` : "Siswa yang perlu perhatian sebelum masalahnya membesar"} />

      {galat ? (
        <EmptyState icon={ShieldAlert} title="Tidak dapat membuka peringatan dini" description={galat} />
      ) : !data ? (
        <div className="flex items-center justify-center min-h-[40vh] text-gray-400"><Loader2 size={24} className="animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile value={data.ringkas.tinggi} label="Risiko Tinggi" icon={AlertOctagon} color="red" size="md" />
            <StatTile value={data.ringkas.sedang} label="Risiko Sedang" icon={Siren} color="amber" size="md" />
            <StatTile value={data.ringkas.pantau} label="Perlu Dipantau" icon={Eye} color="blue" size="md" />
            <StatTile value={data.jumlahSiswa} label="Siswa Aktif Dicek" icon={Users} color="primary" size="md" />
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
            <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 leading-relaxed">
              <p className="font-semibold text-blue-800">Cara skor dihitung</p>
              Alpha berturut-turut ≥3 hari (+3), alpha ≥5× (+3) atau ≥3× (+2), kehadiran &lt;75% (+2), SP 2 ke atas (+3) atau SP 1 (+2),
              ≥2 pelanggaran (+1), nilai turun ≥10 (+2), rata-rata &lt;75 (+1), ≥2 tugas tidak dikumpulkan (+1), ujian online tidak dikerjakan (+2).
              Skor ≥5 = Tinggi, 3–4 = Sedang, 1–2 = Pantau. Data absensi mencakup {data.cakupan.hariAbsensi} hari tercatat.
              {catatanData.length > 0 && <span className="block mt-1 text-blue-600">Belum ikut dihitung karena datanya kosong: {catatanData.join("; ")}.</span>}
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama atau NIS..." className="input-field pl-10" />
            </div>
            <div className="md:w-48"><Select value={tingkat} onChange={setTingkat} options={[
              { value: "SEMUA", label: "Semua tingkat" }, { value: "TINGGI", label: "Risiko tinggi" },
              { value: "SEDANG", label: "Risiko sedang" }, { value: "PANTAU", label: "Perlu dipantau" },
            ]} /></div>
            {daftarKelas.length > 1 && (
              <div className="md:w-48"><Select value={kelas} onChange={setKelas} options={[{ value: "SEMUA", label: "Semua kelas" }, ...daftarKelas.map(k => ({ value: k, label: k }))]} /></div>
            )}
          </div>

          <div className="page-card overflow-hidden">
            <div className="page-card-header">
              <h3 className="font-heading font-semibold text-primary-900">Siswa Perlu Perhatian</h3>
              <span className="text-xs text-gray-400">{tampil.length} dari {data.baris.length} siswa</span>
            </div>
            {tampil.length === 0 ? (
              <EmptyState icon={CalendarX2} title={data.baris.length ? "Tidak ada yang cocok dengan saringan" : "Tidak ada siswa yang perlu perhatian khusus"}
                description={data.baris.length ? "Ubah pencarian atau saringan tingkat/kelas." : "Semua siswa dalam cakupan ini berada di bawah ambang peringatan."} />
            ) : (
              <div className="overflow-x-auto scrollbar-visible">
                <table className="data-table">
                  <thead><tr><th>Siswa</th><th>Kelas</th><th className="text-center">Tingkat</th><th className="text-center">Hadir</th><th className="text-center">Alpha</th><th className="text-center">Poin</th><th>Alasan</th></tr></thead>
                  <tbody>
                    {tampil.map(b => (
                      <tr key={b.studentId}>
                        <td><span className="font-medium text-primary-900">{b.nama}</span><span className="block text-xs text-gray-400 font-mono">{b.nis}</span></td>
                        <td className="whitespace-nowrap">{b.kelas}</td>
                        <td className="text-center">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${GAYA[b.tingkat].kelas}`}>{GAYA[b.tingkat].label} · {b.skor}</span>
                        </td>
                        <td className={`text-center font-semibold ${b.persenHadir !== null && b.persenHadir < 75 ? "text-red-600" : "text-gray-700"}`}>{b.persenHadir !== null ? `${b.persenHadir}%` : "—"}</td>
                        <td className="text-center">{b.alpha30}{b.alphaBeruntun >= 2 && <span className="block text-xs text-red-600 font-semibold">{b.alphaBeruntun} beruntun</span>}</td>
                        <td className="text-center">{b.poinBersih}<span className="block text-xs text-gray-400">{b.levelPoin}</span></td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {b.alasan.map(a => <span key={a} className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-50 text-gray-700 border border-gray-200">{a}</span>)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
