import { verifyRole } from "@/lib/dal";
import IsianRaporWali from "@/components/rapor/IsianRaporWali";

export const dynamic = "force-dynamic";
export const metadata = { title: "Isian Rapor Wali Kelas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; semester?: string }> }) {
  await verifyRole(["TEACHER", "ADMIN", "TAS"]);
  const { classId = "", semester = "" } = await searchParams;
  const q = new URLSearchParams({ classId, semester }).toString();
  return <IsianRaporWali classId={classId} semester={semester} kembaliHref="/dashboard/teacher/rapor-kelas" cetakHref={`/dashboard/teacher/rapor-kelas/cetak?${q}`} />;
}
