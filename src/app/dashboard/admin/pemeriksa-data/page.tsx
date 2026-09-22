import { verifyTasAccess } from "@/lib/tas-access-guard";
import PemeriksaDataManager from "@/components/admin/PemeriksaDataManager";

export const dynamic = "force-dynamic";

export default async function PemeriksaDataPage() {
  await verifyTasAccess();
  return <PemeriksaDataManager />;
}
