export const dynamic = "force-dynamic";

import { LayoutGrid } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { konteksMenuTas } from "@/lib/menu-konteks";
import PageHeader from "@/components/admin/PageHeader";
import { MenuAdmin, MenuTas } from "@/components/shared/MenuPortal";

export const metadata = { title: "Semua Menu" };

/** Portal Admin/TU memakai layout yang sama: Administrator melihat seluruh menu, staf TU melihat
 * menu sesuai jabatannya (aturan yang sama dengan TasSidebar). */
export default async function Page() {
  const session = await verifySession();
  const admin = session.role === "ADMIN";
  const k = admin ? { jabatanNames: [] } : await konteksMenuTas(session);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<LayoutGrid size={22} />} title="Semua Menu" description={admin ? "Seluruh menu administrator" : "Menu Tata Usaha sesuai jabatan Anda"} />
      {admin ? <MenuAdmin /> : <MenuTas jabatanNames={k.jabatanNames} />}
    </div>
  );
}
