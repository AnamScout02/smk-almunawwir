export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import LegalisirManager from "@/components/admin/LegalisirManager";

export default async function LegalisirPage() {
  await verifyTasAccess();
  return <LegalisirManager />;
}
