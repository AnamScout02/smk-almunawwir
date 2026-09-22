export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import TeachingLoadPrintSheet from "@/components/shared/TeachingLoadPrintSheet";
import { buildPrintFilename } from "@/lib/print-filename";

export function generateMetadata() {
  return { title: { absolute: buildPrintFilename("Pembagian_Tugas_Mengajar") } };
}

export default async function TeachingLoadPrintPage() {
  await verifyTasAccess();
  return <TeachingLoadPrintSheet backHref="/dashboard/admin/teaching-assignments" />;
}
