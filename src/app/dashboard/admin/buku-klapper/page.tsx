export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import BukuKlapperManager from "@/components/admin/BukuKlapperManager";

export default async function BukuKlapperPage() {
  await verifyTasAccess();
  return <BukuKlapperManager />;
}
