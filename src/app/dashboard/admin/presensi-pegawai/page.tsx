export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import PresensiPegawaiManager from "@/components/admin/PresensiPegawaiManager";

export default async function PresensiPegawaiPage() {
  await verifyTasAccess();
  return <PresensiPegawaiManager />;
}
