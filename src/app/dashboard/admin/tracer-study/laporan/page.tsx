export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";

import LaporanTracerSheet from "@/components/shared/LaporanTracerSheet";

export const metadata = { title: "Laporan Tracer Study" };

export default async function Page() {
  await verifyRole(["ADMIN", "TAS"]);
  return <LaporanTracerSheet kembaliHref="/dashboard/admin/tracer-study/sebaran" />;
}
