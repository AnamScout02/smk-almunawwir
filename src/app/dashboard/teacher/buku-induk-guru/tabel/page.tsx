export const dynamic = "force-dynamic";

import { verifyBukuIndukFullAccess } from "@/lib/buku-induk-access";
import TabelBukuIndukGuru from "@/components/shared/TabelBukuIndukGuru";

export default async function TeacherTabelBukuIndukGuruPage() {
  await verifyBukuIndukFullAccess();
  return <TabelBukuIndukGuru basePath="/dashboard/teacher/buku-induk-guru" />;
}
