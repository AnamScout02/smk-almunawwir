import { Wrench } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import PageHeader from "@/components/admin/PageHeader";
import PemeliharaanManager from "@/components/admin/PemeliharaanManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mode Pemeliharaan" };

export default async function Page() {
  await verifyRole(["ADMIN"]);
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<Wrench size={22} />} title="Mode Pemeliharaan"
        description="Tutup situs sementara untuk semua pengguna — Superadmin tetap bisa masuk dan memakai seluruh situs" />
      <PemeliharaanManager />
    </div>
  );
}
