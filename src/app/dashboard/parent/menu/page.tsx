export const dynamic = "force-dynamic";

import { LayoutGrid } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import PageHeader from "@/components/admin/PageHeader";
import { MenuOrtu } from "@/components/shared/MenuPortal";

export const metadata = { title: "Semua Menu" };

export default async function Page() {
  await verifyRole(["PARENT"]);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Semua Menu" description="Seluruh layanan untuk orang tua/wali" />
      <MenuOrtu />
    </div>
  );
}
