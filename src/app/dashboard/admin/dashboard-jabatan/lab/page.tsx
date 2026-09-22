import { FlaskConical } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import RingkasanSarpras from "@/components/sarpras/RingkasanSarpras";

/** Salinan portal ADMIN dari dashboard jabatan di portal guru (19 September 2026). Superadmin
 * bukan guru/pegawai, jadi ia melihat dashboard ini TANPA dilempar ke shell portal guru. Isinya
 * komponen yang sama persis — bukan duplikat kode. */
export default function Page() {
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FlaskConical size={22} />} title="Dashboard Laboratorium" description="Aset lab, kerusakan, pemakaian, perawatan, dan stok opname" />
      <RingkasanSarpras lingkupLab base="/dashboard/teacher/lab" inventarisHref="/dashboard/teacher/lab/inventaris" />
    </div>
  );
}
