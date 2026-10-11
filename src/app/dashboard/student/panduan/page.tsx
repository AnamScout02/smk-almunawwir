export const dynamic = "force-dynamic";

import { BookOpenText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { konteksMenuSiswa } from "@/lib/menu-konteks";
import PageHeader from "@/components/admin/PageHeader";
import { MenuSiswa } from "@/components/shared/MenuPortal";

export const metadata = { title: "Panduan" };

export default async function Page() {
  const session = await verifyRole(["STUDENT"]);
  const k = await konteksMenuSiswa(session);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookOpenText size={22} />} title="Panduan" description="Penjelasan tiap fitur yang Anda miliki dan alur kerja peran Anda" />
      <MenuSiswa {...k} sebagai="panduan" />
    </div>
  );
}
