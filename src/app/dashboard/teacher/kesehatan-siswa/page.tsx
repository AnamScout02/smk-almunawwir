export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { cakupanUks, riwayatUks } from "@/lib/uks-akses";
import PageHeader from "@/components/admin/PageHeader";
import RiwayatUksTabel from "@/components/uks/RiwayatUksTabel";

export const metadata = { title: "Kesehatan Siswa" };

/** Riwayat UKS baca-saja untuk Guru BK (semua siswa) dan wali kelas (kelas walinya). */
export default async function Page() {
  const session = await verifyRole(["TEACHER"]);
  const cakupan = await cakupanUks(session);
  if (cakupan !== "SEMUA" && cakupan.length === 0) redirect("/dashboard/teacher");
  const data = await riwayatUks(cakupan === "SEMUA" ? {} : { classIds: cakupan });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8">
      <PageHeader icon={<HeartPulse size={22} />} title="Kesehatan Siswa" description={`Kunjungan UKS 6 bulan terakhir${cakupan === "SEMUA" ? "" : " · kelas wali Anda"} — data rahasia, hanya untuk pendampingan`} />
      <RiwayatUksTabel data={data} />
    </div>
  );
}
