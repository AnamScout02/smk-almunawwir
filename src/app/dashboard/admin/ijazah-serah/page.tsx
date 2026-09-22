export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import IjazahSerahManager from "@/components/admin/IjazahSerahManager";

export default async function IjazahSerahPage() {
  await verifyTasAccess();
  return <IjazahSerahManager />;
}
