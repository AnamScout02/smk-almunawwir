export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import KenaikanKelasManager from "@/components/admin/KenaikanKelasManager";

export default async function KenaikanKelasPage() {
  await verifyTasAccess();
  return <KenaikanKelasManager />;
}
