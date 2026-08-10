import { verifyRole } from "@/lib/dal";
import TataTertibViewer from "@/components/shared/TataTertibViewer";

export const dynamic = "force-dynamic";

export default async function StudentTataTertibPage() {
  await verifyRole(["STUDENT"]);
  return <TataTertibViewer backHref="/dashboard/student/poin-saya" />;
}
