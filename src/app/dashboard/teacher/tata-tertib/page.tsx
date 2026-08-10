import { verifyRole } from "@/lib/dal";
import TataTertibViewer from "@/components/shared/TataTertibViewer";

export const dynamic = "force-dynamic";

export default async function TeacherTataTertibPage() {
  await verifyRole(["TEACHER", "TAS"]);
  return <TataTertibViewer backHref="/dashboard/teacher" />;
}
