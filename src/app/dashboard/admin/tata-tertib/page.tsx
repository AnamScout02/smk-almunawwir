import { verifyRole } from "@/lib/dal";
import TataTertibViewer from "@/components/shared/TataTertibViewer";

export const dynamic = "force-dynamic";

export default async function AdminTataTertibPage() {
  await verifyRole(["ADMIN"]);
  return <TataTertibViewer backHref="/dashboard/admin/poin-siswa" />;
}
