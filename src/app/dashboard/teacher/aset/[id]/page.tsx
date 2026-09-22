export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { aksesSarpras } from "@/lib/sarpras-akses";
import DetailAset from "@/components/sarpras/DetailAset";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, session] = await Promise.all([params, verifyRole(["TEACHER"])]);
  const a = await aksesSarpras(session);
  return <DetailAset id={id} inventarisHref={a.penuh ? "/dashboard/teacher/wakasek/sarpras/inventaris" : a.lab ? "/dashboard/teacher/lab/inventaris" : undefined} />;
}
