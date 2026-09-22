export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import DetailAset from "@/components/sarpras/DetailAset";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }] = await Promise.all([params, verifyRole(["ADMIN", "TAS"])]);
  return <DetailAset id={id} inventarisHref="/dashboard/admin/inventaris" />;
}
