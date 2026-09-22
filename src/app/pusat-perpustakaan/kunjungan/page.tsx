import PitaPortal from "@/components/shared/PitaPortal";
import KioskKunjungan from "@/components/perpustakaan/KioskKunjungan";

export default function KunjunganPage() {
  // Halaman ini tanpa PageHeader → pita menu portal dipasang sendiri (lihat PitaPortal).
  return <><PitaPortal mandiri /><KioskKunjungan /></>;
}
