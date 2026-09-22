export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import RaporHandoverManager from "@/components/admin/RaporHandoverManager";

export default async function RaporHandoverPage() {
  await verifyTasAccess();
  return <RaporHandoverManager />;
}
