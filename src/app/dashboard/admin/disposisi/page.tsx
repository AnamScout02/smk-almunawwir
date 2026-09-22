export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import DisposisiManager from "@/components/admin/DisposisiManager";

export default async function DisposisiPage() {
  await verifyTasAccess();
  return <DisposisiManager />;
}
