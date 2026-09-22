import { verifyRole } from "@/lib/dal";
import KeamananSesiManager from "@/components/admin/KeamananSesiManager";

export const dynamic = "force-dynamic";

export default async function KeamananSesiPage() {
  await verifyRole(["ADMIN"]);
  return <KeamananSesiManager />;
}
