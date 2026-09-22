import PitaPortal from "@/components/shared/PitaPortal";
import KartuAnggotaDigital from "@/components/perpustakaan/KartuAnggotaDigital";

export default function KartuAnggotaPage() {
  // Halaman ini tanpa PageHeader → pita menu portal dipasang sendiri (lihat PitaPortal).
  return <><PitaPortal mandiri /><KartuAnggotaDigital /></>;
}
