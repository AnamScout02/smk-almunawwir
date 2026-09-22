export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import KalenderPendidikanManager from "@/components/admin/KalenderPendidikanManager";

export default async function KalenderPendidikanPage() {
  await verifyTasAccess();
  return <KalenderPendidikanManager />;
}
