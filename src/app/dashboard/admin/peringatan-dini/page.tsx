export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import PeringatanDiniManager from "@/components/shared/PeringatanDiniManager";

export default async function PeringatanDiniAdminPage() {
  await verifyRole(["ADMIN"]);
  return <PeringatanDiniManager />;
}
