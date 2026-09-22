"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, Award, Loader2, Printer } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import StatTile from "@/components/admin/StatTile";
import EmptyState from "@/components/admin/EmptyState";
import { BarDaftar } from "@/components/shared/GrafikRingkas";

type Tab = "hari" | "kerawanan" | "prestasi";
interface Hari { tanggal: string; libur: string | null; terlambat: number; diLuar: number; total: Record<string, number>; kelas: { id: string; nama: string; siswa: number; HADIR: number; IZIN: number; SAKIT: number; ALPHA: number; tercatat: number; persen: number | null }[] }
interface Kerawanan { semester: string; ringkas: { tinggi: number; sedang: number; pantau: number }; baris: { id: string; nama: string; siswa: number; alpha: number; poin: number; pelanggaran30: number; tinggi: number; sedang: number; kasusAktif: number; konseling: number; skor: number }[] }
interface Prestasi { semester: string; teratas: { nama: string; kelas: string; poin: number; jumlah: number }[]; daftar: { id: string; jenis: string; catatan: string | null; poin: number; tanggal: string; bersertifikat: boolean; nama: string; nis: string; kelas: string }[] }

const warnaSkor = (n: number) => n >= 60 ? "bg-red-50 text-red-700 border-red-200" : n >= 30 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";

/** PAPAN KESISWAAN (17 Sep 2026): kehadiran hari ini per kelas, peta kerawanan kelas, prestasi & piagam. */
export default function PapanKesiswaan({ sertifikatBase, tanpaHeader = false }: { sertifikatBase: string; tanpaHeader?: boolean }) {
  const [tab, setTab] = useState<Tab>("hari");
  const [isi, setIsi] = useState<Record<Tab, unknown>>({ hari: null, kerawanan: null, prestasi: null });
  const [galat, setGalat] = useState("");
  useEffect(() => {
    if (isi[tab]) return;
    fetch(`/api/teacher/kesiswaan/papan?bagian=${tab}`, { cache: "no-store" }).then(async r => {
      const d = await r.json().catch(() => null);
      if (!r.ok) setGalat(d?.error ?? "Gagal memuat."); else setIsi(p => ({ ...p, [tab]: d }));
    }).catch(() => setGalat("Gagal memuat."));
  }, [tab, isi]);

  const hari = isi.hari as Hari | null;
  const rawan = isi.kerawanan as Kerawanan | null;
  const pres = isi.prestasi as Prestasi | null;
  const memuat = <div className="flex justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin" /></div>;
  const belumAbsen = hari?.kelas.filter(k => k.siswa > 0 && k.tercatat === 0) ?? [];
  return (
    <div className={tanpaHeader ? "" : "p-6 lg:p-8 pt-16 lg:pt-8"}>
      {!tanpaHeader && <PageHeader icon={<Activity size={22} />} title="Papan Kesiswaan" description="Kehadiran hari ini, kelas yang perlu perhatian, dan prestasi siswa" />}
      <div className="alat-tab mb-5 flex w-fit gap-1 rounded-xl bg-gray-100 p-1">
        {([["hari", "Kehadiran hari ini"], ["kerawanan", "Peta kerawanan"], ["prestasi", "Prestasi"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? "bg-primary-900 text-white" : "text-gray-500 hover:bg-gray-50"}`}>{l}</button>
        ))}
      </div>
      {galat ? <EmptyState icon={Activity} title="Tidak tersedia" description={galat} /> : tab === "hari" ? (!hari ? memuat : (
        <div className="space-y-5">
          {hari.libur && <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">Hari ini libur: {hari.libur}</p>}
          <div className="kisi-kartu kisi-kartu-4">
            <StatTile ikon="hadir" color="emerald" value={hari.total.HADIR ?? 0} label="Hadir" />
            <StatTile ikon="alpha" color={(hari.total.ALPHA ?? 0) ? "red" : "emerald"} value={hari.total.ALPHA ?? 0} label={`Alpha · izin ${hari.total.IZIN ?? 0} · sakit ${hari.total.SAKIT ?? 0}`} />
            <StatTile ikon="jam" color={hari.terlambat ? "amber" : "blue"} value={hari.terlambat} label="Terlambat (poin piket)" />
            <StatTile ikon="menunggu" color={belumAbsen.length ? "amber" : "emerald"} value={belumAbsen.length} label={`Kelas belum diabsen · ${hari.diLuar} siswa di luar`} sorot={belumAbsen.length > 0} />
          </div>
          <div className="panel overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Kelas</th><th className="text-center">Siswa</th><th className="text-center">Hadir</th><th className="text-center">Izin</th><th className="text-center">Sakit</th><th className="text-center">Alpha</th><th className="text-center">% Hadir</th></tr></thead>
              <tbody>{hari.kelas.filter(k => k.siswa > 0).map(k => (
                <tr key={k.id} className={k.tercatat === 0 ? "bg-amber-50/40" : ""}>
                  <td className="font-semibold text-primary-900">{k.nama}{k.tercatat === 0 && <span className="ml-2 text-xs font-normal text-amber-700">belum diabsen</span>}</td>
                  <td className="angka text-center">{k.siswa}</td>
                  <td className="angka text-center">{k.HADIR}</td><td className="angka text-center">{k.IZIN}</td><td className="angka text-center">{k.SAKIT}</td>
                  <td className={`angka text-center ${k.ALPHA ? "font-bold text-red-600" : ""}`}>{k.ALPHA}</td>
                  <td className="angka text-center">{k.persen == null ? "—" : `${k.persen}%`}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )) : tab === "kerawanan" ? (!rawan ? memuat : (
        <div className="space-y-5">
          <div className="kisi-kartu kisi-kartu-3">
            <StatTile ikon="peringatan" color="red" value={rawan.ringkas.tinggi} label="Siswa risiko tinggi" />
            <StatTile ikon="waspada" color="amber" value={rawan.ringkas.sedang} label="Risiko sedang" />
            <StatTile ikon="perisai" color="blue" value={rawan.ringkas.pantau} label="Perlu dipantau" />
          </div>
          <div className="panel overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Kelas</th><th className="text-center">Skor</th><th className="text-center">Risiko tinggi/sedang</th><th className="text-center">Alpha 30 hr</th><th className="text-center">Pelanggaran 30 hr</th><th className="text-center">Poin semester</th><th className="text-center">Kasus BK aktif</th><th className="text-center">Konseling 30 hr</th></tr></thead>
              <tbody>{rawan.baris.map(b => (
                <tr key={b.id}>
                  <td className="font-semibold text-primary-900">{b.nama} <span className="text-xs font-normal text-gray-500">({b.siswa})</span></td>
                  <td className="text-center"><span className={`status-badge angka ${warnaSkor(b.skor)}`}>{b.skor}</span></td>
                  <td className="angka text-center">{b.tinggi} / {b.sedang}</td>
                  <td className="angka text-center">{b.alpha}</td><td className="angka text-center">{b.pelanggaran30}</td><td className="angka text-center">{b.poin}</td>
                  <td className="angka text-center">{b.kasusAktif}</td><td className="angka text-center">{b.konseling}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500">Skor kerawanan dihitung per siswa dari alpha, pelanggaran 30 hari, siswa berisiko (peringatan dini), dan kasus BK aktif — makin tinggi makin perlu pendampingan. Rincian per siswa di menu Peringatan Dini.</p>
        </div>
      )) : (!pres ? memuat : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12 items-start">
          <div className="panel p-5 xl:col-span-4 min-w-0">
            <p className="label-kecil mb-3">Poin prestasi tertinggi · {pres.semester}</p>
            {pres.teratas.length === 0 ? <p className="text-sm text-gray-500">Belum ada prestasi semester ini.</p>
              : <BarDaftar data={pres.teratas.map((t, i) => ({ kunci: `${i}`, label: t.nama, sublabel: `${t.kelas} · ${t.jumlah} prestasi`, nilai: t.poin }))} satuan="poin" />}
          </div>
          <div className="panel overflow-x-auto xl:col-span-8 min-w-0">
            {pres.daftar.length === 0 ? <EmptyState icon={Award} title="Belum ada prestasi" description="Prestasi dicatat lewat menu Poin Siswa (jenis Prestasi)." /> : (
              <table className="data-table">
                <thead><tr><th>Siswa</th><th>Prestasi</th><th className="hidden md:table-cell">Tanggal</th><th className="text-right">Piagam</th></tr></thead>
                <tbody>{pres.daftar.map(p => (
                  <tr key={p.id}>
                    <td className="min-w-[9rem]"><p className="font-semibold text-primary-900">{p.nama}</p><p className="text-xs text-gray-500">{p.kelas}</p></td>
                    <td className="min-w-[10rem]"><p className="text-sm">{p.jenis}</p>{p.catatan && <p className="text-xs text-gray-500">{p.catatan}</p>}</td>
                    <td className="hidden md:table-cell text-xs whitespace-nowrap">{new Date(p.tanggal).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" })}</td>
                    <td className="text-right"><Link href={`${sertifikatBase}/${p.id}/sertifikat`} className="btn-modal-cancel px-2.5 text-xs"><Printer /> {p.bersertifikat ? "Cetak" : "Terbitkan"}</Link></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
