export const dynamic = "force-dynamic";
import { Signature } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import TandaTanganPegawaiManager from "@/components/kepegawaian/TandaTanganPegawaiManager";

export const metadata = { title: "Tanda Tangan Pegawai" };

export default async function Page() {
  await verifyTasAccess();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Signature size={22} />} title="Tanda Tangan Pegawai"
        description="Tanda tangan digital guru & staf untuk daftar hadir rapat, berita acara ujian, dan rapor" />
      <TandaTanganPegawaiManager />
    </div>
  );
}
