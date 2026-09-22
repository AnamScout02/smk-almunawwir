export const dynamic = "force-dynamic";

import { LayoutGrid } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { konteksMenuSiswa } from "@/lib/menu-konteks";
import PageHeader from "@/components/admin/PageHeader";
import { MenuSiswa } from "@/components/shared/MenuPortal";

export const metadata = { title: "Semua Menu" };

export default async function Page() {
  const session = await verifyRole(["STUDENT"]);
  const k = await konteksMenuSiswa(session);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Semua Menu" description="Seluruh fitur portal siswa dalam satu halaman" />
      <MenuSiswa {...k} />
    </div>
  );
}
