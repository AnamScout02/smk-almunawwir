export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import SuratTugasManager from "@/components/admin/SuratTugasManager";

export default async function SuratTugasPage() {
  await verifyTasAccess();
  return <SuratTugasManager />;
}
