export const dynamic = "force-dynamic";

import { BookOpenText } from "lucide-react";
import { verifySession } from "@/lib/dal";
import { konteksMenuTas } from "@/lib/menu-konteks";
import PageHeader from "@/components/admin/PageHeader";
import { MenuAdmin, MenuTas } from "@/components/shared/MenuPortal";

export const metadata = { title: "Panduan" };

/** Portal Admin/TU memakai layout yang sama: Administrator melihat seluruh menu, staf TU melihat
 * menu sesuai jabatannya (aturan yang sama dengan TasSidebar). */
export default async function Page() {
  const session = await verifySession();
  const admin = session.role === "ADMIN";
  const k = admin ? { jabatanNames: [] } : await konteksMenuTas(session);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookOpenText size={22} />} title="Panduan" description="Penjelasan tiap fitur yang Anda miliki dan alur kerja peran Anda" />
      {admin ? <MenuAdmin sebagai="panduan" /> : <MenuTas jabatanNames={k.jabatanNames} sebagai="panduan" />}
    </div>
  );
}
