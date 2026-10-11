"use client";
import { useRouter } from "next/navigation";
import Select from "@/components/admin/Select";
import MonthPicker from "@/components/shared/MonthPicker";

/** Pemilih ekskul & bulan untuk halaman server Laporan Bulanan (`?ekskul=&bulan=`). */
export default function PilihLaporanEkstra({ ekskul, bulan, daftar }: { ekskul: string; bulan: string; daftar: { id: string; nama: string }[] }) {
  const router = useRouter();
  const ke = (e: string, b: string) => router.push(`/pusat-ekstra/laporan?ekskul=${e}&bulan=${b}`);
  return (
    <>
      <div className="alat-saring"><Select value={ekskul} onChange={v => ke(v, bulan)} options={daftar.map(d => ({ value: d.id, label: d.nama }))} placeholder="Pilih ekstrakurikuler" /></div>
      <div className="alat-saring"><MonthPicker value={bulan} onChange={v => { if (v) ke(ekskul, v); }} /></div>
    </>
  );
}
