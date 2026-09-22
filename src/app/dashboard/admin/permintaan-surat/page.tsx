export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import PermintaanSuratManager from "@/components/admin/PermintaanSuratManager";

export default async function PermintaanSuratPage() {
  await verifyTasAccess();
  return <PermintaanSuratManager />;
}
