export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import TeachingLoadPrintSheet from "@/components/shared/TeachingLoadPrintSheet";

export default async function KurikulumPenugasanPrintPage() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await assertKurikulum(session);
  return <TeachingLoadPrintSheet backHref="/dashboard/teacher/wakasek/kurikulum/penugasan" />;
}
