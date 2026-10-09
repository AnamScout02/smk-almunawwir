import { MapPinned } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { TautanIkon } from "@/components/shared/IkonNama";
import PetaSebaran from "@/components/spmb/PetaSebaran";
import { sebaranPetaSiswa } from "@/lib/peta-sebaran";

/** Halaman PETA SEBARAN untuk portal Superadmin & guru berjabatan (8 Oktober 2026) — komponen & hitungan SAMA dengan
 *  panel di Pusat SPMB → Statistik & Sebaran, jadi angkanya tidak pernah berbeda. Penjaga di pembungkus portal. */
export default async function PetaSebaranHalaman({ basePath }: { basePath: string }) {
  const siswa = await sebaranPetaSiswa();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<MapPinned size={22} />} title="Peta Sebaran"
        description="Asal daerah siswa aktif — dari Indonesia sampai desa" />
      <div className="alat-aksi alat-teks mb-5 justify-end">
        <TautanIkon href={`${basePath}/peta-sebaran/analisis`} ikon="kontak" className="btn-modal-cancel">Alamat Belum Lengkap</TautanIkon>
      </div>
      <div className="panel p-4 sm:p-5">
        <PetaSebaran siswa={siswa} lapis={["siswa"]} />
      </div>
    </div>
  );
}
