export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import KartuQrTracer from "@/components/shared/KartuQrTracer";

export default async function Page() {
  await verifyRole(["TEACHER"]);
  return <KartuQrTracer kembaliHref="/dashboard/teacher/humas/tracer-study" />;
}
