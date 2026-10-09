"use client";
import { useRouter } from "next/navigation";
import MonthPicker from "@/components/shared/MonthPicker";

/** Pemilih bulan untuk halaman server berparameter `?bulan=YYYY-MM` (Laporan Bulanan TU). */
export default function PilihBulanLaporan({ bulan, dasar }: { bulan: string; dasar: string }) {
  const router = useRouter();
  return <MonthPicker value={bulan} onChange={v => { if (v) router.push(`${dasar}?bulan=${v}`); }} />;
}
