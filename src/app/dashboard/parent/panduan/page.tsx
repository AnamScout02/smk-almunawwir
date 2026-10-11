export const dynamic = "force-dynamic";

import { BookOpenText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import PageHeader from "@/components/admin/PageHeader";
import { MenuOrtu } from "@/components/shared/MenuPortal";

export const metadata = { title: "Panduan" };

export default async function Page() {
  await verifyRole(["PARENT"]);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<BookOpenText size={22} />} title="Panduan" description="Penjelasan tiap layanan dan cara memakainya" />
      <MenuOrtu sebagai="panduan" />
    </div>
  );
}
