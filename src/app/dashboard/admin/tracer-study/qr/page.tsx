export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import KartuQrTracer from "@/components/shared/KartuQrTracer";

export default async function Page() {
  await verifyRole(["ADMIN", "TAS"]);
  return <KartuQrTracer kembaliHref="/dashboard/admin/tracer-study" />;
}
