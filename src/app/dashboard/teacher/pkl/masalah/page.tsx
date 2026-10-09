import LaporanPklManager from "@/components/pkl/LaporanPklManager";

/** Laporan masalah PKL untuk GURU PEMBIMBING — hanya siswa bimbingannya (disaring di /api/pkl/laporan). */
export default function Page() { return <LaporanPklManager kembaliHref="/dashboard/teacher/pkl" />; }
