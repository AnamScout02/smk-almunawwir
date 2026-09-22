export const dynamic = "force-dynamic";

import { verifyTasAccess } from "@/lib/tas-access-guard";
import BantuanSiswaManager from "@/components/admin/BantuanSiswaManager";

export default async function BantuanSiswaPage() {
  await verifyTasAccess();
  return <BantuanSiswaManager />;
}
