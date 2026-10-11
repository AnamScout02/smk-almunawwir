import { verifyRole } from "@/lib/dal";
import StatistikPemakaianManager from "@/components/admin/StatistikPemakaianManager";

export const metadata = { title: "Statistik Pemakaian" };

export default async function Page() {
  await verifyRole(["ADMIN"]);
  return <StatistikPemakaianManager />;
}
