import { verifyRole } from "@/lib/dal";
import TataTertibViewer from "@/components/shared/TataTertibViewer";
import { buildPrintFilename } from "@/lib/print-filename";

export const dynamic = "force-dynamic";

export function generateMetadata() {
  return { title: { absolute: buildPrintFilename("Tata_Tertib_Sekolah") } };
}

export default async function StudentTataTertibPage() {
  await verifyRole(["STUDENT"]);
  return <TataTertibViewer backHref="/dashboard/student/poin-saya" />;
}
