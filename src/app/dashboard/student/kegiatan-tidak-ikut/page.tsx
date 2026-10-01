import TidakIkutKegiatan from "@/components/kegiatan/TidakIkutKegiatan";

/* Cakupan ditentukan SERVER menurut peran (lihat /api/kegiatan/ketidakhadiran) — halaman ini sama
   untuk siswa, orang tua, wali kelas, Kesiswaan/BK, dan Admin. */
export default function Page() {
  return <TidakIkutKegiatan />;
}
