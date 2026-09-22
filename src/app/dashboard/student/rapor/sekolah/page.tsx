import { FileText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/admin/PageHeader";
import RaporSekolahSiswa from "@/components/rapor/RaporSekolahSiswa";
import type { JenisRapor } from "@/components/rapor/CetakRapor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rapor Sekolah" };

export default async function Page({ searchParams }: { searchParams: Promise<{ semester?: string; jenis?: string }> }) {
  const session = await verifyRole(["STUDENT"]);
  const { semester = "", jenis: j } = await searchParams;
  const jenis: JenisRapor = j === "ts" || j === "diniyah" ? j : "akhir";
  const siswa = await prisma.student.findFirst({ where: { user: { email: session.email } }, select: { id: true, classId: true } });
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<FileText size={22} />} title="Rapor Sekolah" description={`Semester ${semester}`} printHidden />
      {siswa ? (
        <RaporSekolahSiswa studentId={siswa.id} classId={siswa.classId} semester={semester} jenis={jenis} kembaliHref="/dashboard/student/rapor"
          href={x => `/dashboard/student/rapor/sekolah?${new URLSearchParams({ semester, jenis: x }).toString()}`} />
      ) : <p className="error-msg">Data siswa tidak ditemukan.</p>}
    </div>
  );
}
