import PanitiaSpmbManager from "@/components/spmb/PanitiaSpmbManager";

export const metadata = { title: "Panitia PKL" };

/** Panitia PKL — layar yang sama dengan Panitia SPMB (satu komponen), menunjuk daftar & API milik PKL. */
export default function Page() {
  return <PanitiaSpmbManager api="/api/pkl/panitia" nama="PKL" otomatis="Otomatis panitia: Admin, staf berjabatan Tenaga Administrasi Sekolah, dan guru pemegang jabatan Wakil Kepala Humas." />;
}
