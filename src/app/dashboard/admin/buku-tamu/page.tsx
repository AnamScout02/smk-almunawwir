export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import BukuTamuManager from "@/components/admin/BukuTamuManager";

export default async function BukuTamuPage() {
  await verifyTasAccess();
  return <BukuTamuManager />;
}
