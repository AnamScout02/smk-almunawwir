import { Wrench } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import RingkasanSarpras from "@/components/sarpras/RingkasanSarpras";

export const metadata = { title: "Sarana & Prasarana" };

export default function Page() {
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Wrench size={22} />} title="Sarana & Prasarana" description="Inventaris, kerusakan, peminjaman, perawatan, dan stok opname" />
      <RingkasanSarpras lingkupLab={false} base="/dashboard/admin/sarpras" inventarisHref="/dashboard/admin/inventaris" />
    </div>
  );
}
