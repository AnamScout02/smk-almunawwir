export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import NotifikasiPushManager from "@/components/admin/NotifikasiPushManager";

export default async function NotifikasiPushPage() {
  await verifyRole(["ADMIN"]);
  return <NotifikasiPushManager />;
}
