export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import CutiManager from "@/components/admin/CutiManager";

export default async function CutiPage() {
  await verifyTasAccess();
  return <CutiManager />;
}
