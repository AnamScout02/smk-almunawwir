export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { assertJabatan, jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import SebaranAlumniHalaman from "@/components/shared/SebaranAlumniHalaman";

export default async function Page() {
  const session = await verifyRole(["TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertJabatan(session, ["Koordinator BKK", "Wakil Kepala Humas"]));
  return <SebaranAlumniHalaman dasar="/dashboard/teacher/humas/tracer-study" />;
}
