export const dynamic = "force-dynamic";

import { LayoutGrid } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { konteksMenuGuru } from "@/lib/menu-konteks";
import PageHeader from "@/components/admin/PageHeader";
import { MenuGuru } from "@/components/shared/MenuPortal";

export const metadata = { title: "Semua Menu" };

export default async function Page() {
  const session = await verifyRole(["TEACHER", "ADMIN"]);
  const k = await konteksMenuGuru(session);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Semua Menu" description="Seluruh fitur portal guru sesuai tugas & jabatan Anda" />
      <MenuGuru {...k} />
    </div>
  );
}
