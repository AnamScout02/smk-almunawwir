export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { assertKurikulum } from "@/lib/kurikulum-guard";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import TeachingLoadPrintSheet from "@/components/shared/TeachingLoadPrintSheet";
import { buildPrintFilename } from "@/lib/print-filename";

export function generateMetadata() {
  return { title: { absolute: buildPrintFilename("Pembagian_Tugas_Mengajar") } };
}

export default async function KurikulumPenugasanPrintPage() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertKurikulum(session)); // tanpa jabatan → dialihkan, bukan 500
  return <TeachingLoadPrintSheet backHref="/dashboard/teacher/wakasek/kurikulum/penugasan" />;
}
