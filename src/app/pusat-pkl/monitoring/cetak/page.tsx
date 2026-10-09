export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { aksesPusatPkl } from "@/lib/pkl-humas";
import LaporanMonitoringCetak from "@/components/pkl/LaporanMonitoringCetak";

export const metadata = { title: "Laporan Monitoring PKL" };

export default async function Page({ searchParams }: { searchParams: Promise<{ guru?: string; bulan?: string }> }) {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  if (!(await aksesPusatPkl(session))) redirect(session.role === "TEACHER" ? "/dashboard/teacher" : "/dashboard/admin");
  const { guru, bulan } = await searchParams;
  if (!guru) redirect("/pusat-pkl/monitoring");
  return <LaporanMonitoringCetak teacherId={guru} bulan={bulan ?? ""} kembaliHref="/pusat-pkl/monitoring" />;
}
