export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import RekapBulananKepsek from "@/components/jabatan/RekapBulananKepsek";

export const metadata = { title: "Rekap Bulanan" };

export default async function Page({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  await verifyRole(["ADMIN"]);
  return <RekapBulananKepsek bulan={(await searchParams).bulan} dasar="/dashboard/admin/rekap-bulanan" />;
}
