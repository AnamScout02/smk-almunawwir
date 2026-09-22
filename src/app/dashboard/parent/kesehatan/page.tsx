export const dynamic = "force-dynamic";

import { HeartPulse } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import { riwayatUks } from "@/lib/uks-akses";
import PageHeader from "@/components/admin/PageHeader";
import RiwayatUksTabel from "@/components/uks/RiwayatUksTabel";

export const metadata = { title: "Kesehatan — Portal Orang Tua" };

export default async function Page({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { studentId } = await searchParams;
  const child = resolveSelectedChild(await getParentChildrenOrRedirect(session), studentId);
  const data = await riwayatUks({ studentId: child.id });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<HeartPulse size={22} />} title="Kesehatan di Sekolah" description={`Kunjungan UKS 6 bulan terakhir — ${child.user.name}`} />
      <RiwayatUksTabel data={data} tampilSiswa={false} />
    </div>
  );
}
