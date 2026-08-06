export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import TeachingLoadPrintSheet from "@/components/shared/TeachingLoadPrintSheet";

export default async function TeachingLoadPrintPage() {
  await verifyRole(["ADMIN", "TAS"]);
  return <TeachingLoadPrintSheet backHref="/dashboard/admin/teaching-assignments" />;
}
