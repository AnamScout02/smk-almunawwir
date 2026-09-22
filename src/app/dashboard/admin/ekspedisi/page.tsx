export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import EkspedisiManager from "@/components/admin/EkspedisiManager";

export default async function EkspedisiPage() {
  await verifyTasAccess();
  return <EkspedisiManager />;
}
