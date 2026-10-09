export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertPeta } from "@/lib/peta-guard";
import AnalisisSebaranHalaman from "@/components/shared/AnalisisSebaranHalaman";

export default async function Page({ searchParams }: { searchParams: Promise<{ bagian?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS"]);
  await jabatanAtauAlihkan(session, () => assertPeta(session));
  const { bagian } = await searchParams;
  return <AnalisisSebaranHalaman alamat="/dashboard/admin/peta-sebaran/analisis" kembaliHref="/dashboard/admin/peta-sebaran" bagian={bagian} tampil={["alamat"]}
    judul="Alamat Belum Lengkap" keterangan="Siswa aktif yang belum muncul di peta sampai kecamatan, per kelas" />;
}
