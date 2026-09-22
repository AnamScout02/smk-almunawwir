import { FileText } from "lucide-react";
import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect, resolveSelectedChild } from "@/lib/parent-guard";
import PageHeader from "@/components/admin/PageHeader";
import RaporSekolahSiswa from "@/components/rapor/RaporSekolahSiswa";
import type { JenisRapor } from "@/components/rapor/CetakRapor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rapor Sekolah" };

export default async function Page({ searchParams }: { searchParams: Promise<{ studentId?: string; semester?: string; jenis?: string }> }) {
  const session = await verifyRole(["PARENT"]);
  const { studentId, semester = "", jenis: j } = await searchParams;
  const jenis: JenisRapor = j === "ts" || j === "diniyah" ? j : "akhir";
  const anak = resolveSelectedChild(await getParentChildrenOrRedirect(session), studentId);
  const q = (x: JenisRapor) => new URLSearchParams({ studentId: anak.id, semester, jenis: x }).toString();
  return (
    <div className="p-6 lg:p-8 pt-16 lg:pt-8 print:p-0">
      <PageHeader icon={<FileText size={22} />} title="Rapor Sekolah" description={`${anak.user.name} · Semester ${semester}`} printHidden />
      <RaporSekolahSiswa studentId={anak.id} classId={anak.classId} semester={semester} jenis={jenis}
        kembaliHref={`/dashboard/parent/rapor?studentId=${anak.id}`} href={x => `/dashboard/parent/rapor/sekolah?${q(x)}`} />
    </div>
  );
}
