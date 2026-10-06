import AnalisisButirKegiatan from "@/components/ujian/AnalisisButirKegiatan";

export const metadata = { title: "Analisis Butir Soal" };

/** Rekap analisis butir & reliabilitas per kegiatan ujian (5 Oktober 2026). Penjaga ada di layout Pusat Ujian & API. */
export default function AnalisisButirPage() {
  return <AnalisisButirKegiatan />;
}
