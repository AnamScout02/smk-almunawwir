export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import LaporanMonitoringCetak from "@/components/pkl/LaporanMonitoringCetak";

export const metadata = { title: "Laporan Monitoring PKL" };

/** Guru pembimbing mencetak laporan monitoringnya SENDIRI (id guru dari sesi, bukan dari alamat). */
export default async function Page({ searchParams }: { searchParams: Promise<{ bulan?: string }> }) {
  const session = await verifyRole(["TEACHER"]);
  const guru = await prisma.teacher.findFirst({ where: { userId: session.userId }, select: { id: true } });
  if (!guru) redirect("/dashboard/teacher");
  const { bulan } = await searchParams;
  const kini = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
  return <LaporanMonitoringCetak teacherId={guru.id} bulan={bulan ?? kini} kembaliHref="/dashboard/teacher/pkl" />;
}
