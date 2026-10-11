export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import AnalitikData from "@/components/jabatan/AnalitikData";

export const metadata = { title: "Analitik Data" };

export default async function Page({ searchParams }: { searchParams: Promise<{ bagian?: string }> }) {
  await verifyRole(["ADMIN"]);
  return <AnalitikData bagian={(await searchParams).bagian} dasar="/dashboard/admin/analitik" bolehGuru bolehAtur />;
}
