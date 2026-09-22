import { FlaskConical } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import RingkasanSarpras from "@/components/sarpras/RingkasanSarpras";

export const metadata = { title: "Dashboard Laboratorium" };

/** DASHBOARD KEPALA LABORATORIUM (17 Sep 2026). */
export default function Page() {
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<FlaskConical size={22} />} title="Dashboard Laboratorium" description="Aset lab, kerusakan, pemakaian, perawatan, dan stok opname" />
      <RingkasanSarpras lingkupLab base="/dashboard/teacher/lab" inventarisHref="/dashboard/teacher/lab/inventaris" />
    </div>
  );
}
