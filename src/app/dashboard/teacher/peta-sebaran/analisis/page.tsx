export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { assertJabatan, jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertPeta } from "@/lib/peta-guard";
import AnalisisSebaranHalaman from "@/components/shared/AnalisisSebaranHalaman";

export default async function Page({ searchParams }: { searchParams: Promise<{ bagian?: string }> }) {
  const session = await verifyRole(["TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertPeta(session));
  const { bagian } = await searchParams;
  // Hanya Operator Sekolah yang boleh MENGUBAH Buku Induk dari portal guru — selain itu nama tidak ditautkan (tautan yang memantul = "tombol rusak").
  const operator = await assertJabatan(session, ["Operator Sekolah"]).then(() => true).catch(() => false);
  return <AnalisisSebaranHalaman indukHref={operator ? "/dashboard/teacher/buku-induk-siswa" : undefined} alamat="/dashboard/teacher/peta-sebaran/analisis" kembaliHref="/dashboard/teacher/peta-sebaran" bagian={bagian} tampil={["alamat"]}
    judul="Alamat Belum Lengkap" keterangan="Siswa aktif yang belum muncul di peta sampai kecamatan, per kelas" />;
}
