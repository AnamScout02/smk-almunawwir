export const dynamic = "force-dynamic";
import { verifySpmbAccess } from "@/lib/spmb";
import AnalisisSebaranHalaman from "@/components/shared/AnalisisSebaranHalaman";

/** Sasaran promosi & asal sekolah — bahan panitia memilih kecamatan/sekolah yang didatangi saat sosialisasi. */
export default async function Page({ searchParams }: { searchParams: Promise<{ bagian?: string; dari?: string; sampai?: string; kab?: string; kec?: string; jenjang?: string; status?: string; q?: string; urut?: string; r?: string }> }) {
  await verifySpmbAccess();
  const { bagian, dari, sampai, ...potensi } = await searchParams;
  return <AnalisisSebaranHalaman alamat="/pusat-spmb/sasaran" laporanHref="/pusat-spmb/sasaran/laporan"
    bagian={bagian} dari={dari} sampai={sampai} potensi={potensi} tampil={["promosi", "sekolah", "potensi", "persaingan", "proyeksi"]} judul="Sasaran & Potensi"
    keterangan="Kecamatan & sekolah asal siswa, yang menurun, dan jumlah calon lulusan SMP/MTs tiap sekolah" />;
}
