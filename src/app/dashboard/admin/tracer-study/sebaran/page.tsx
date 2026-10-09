export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";

import SebaranAlumniHalaman from "@/components/shared/SebaranAlumniHalaman";

export default async function Page() {
  await verifyRole(["ADMIN", "TAS"]);
  return <SebaranAlumniHalaman dasar="/dashboard/admin/tracer-study" />;
}
