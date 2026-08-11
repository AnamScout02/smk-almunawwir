export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import TeachingLoadPrintSheet from "@/components/shared/TeachingLoadPrintSheet";

export default async function TeachingLoadPrintPage() {
  await verifyTasAccess();
  return <TeachingLoadPrintSheet backHref="/dashboard/admin/teaching-assignments" />;
}
