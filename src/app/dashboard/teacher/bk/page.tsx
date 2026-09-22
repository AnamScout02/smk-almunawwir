
import PeringatanDiniManager from "@/components/shared/PeringatanDiniManager";

// Dashboard BK = Peringatan Dini Siswa seluruh sekolah (14 Sep 2026). Dulu hanya ambang kehadiran <75% & nilai <75
// dari /api/teacher/bk/summary; kini skor gabungan alpha beruntun, poin/SP, nilai turun, tugas & ujian online.
export default function BkDashboard() {
  return <PeringatanDiniManager judul="Dashboard Bimbingan Konseling" varian="bk" />;
}
