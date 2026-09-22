export const dynamic = "force-dynamic";

import { LayoutGrid } from "lucide-react";
import { verifyBendaharaLayoutAccess } from "@/lib/bendahara-guard";
import PageHeader from "@/components/admin/PageHeader";
import { MenuBendahara } from "@/components/shared/MenuPortal";

export const metadata = { title: "Semua Menu" };

export default async function Page() {
  await verifyBendaharaLayoutAccess();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Semua Menu" description="Seluruh menu portal bendahara" />
      <MenuBendahara />
    </div>
  );
}
