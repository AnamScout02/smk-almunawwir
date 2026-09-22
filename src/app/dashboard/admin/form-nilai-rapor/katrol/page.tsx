import CetakFormKatrol from "@/components/rapor/CetakFormKatrol";

export const dynamic = "force-dynamic";
export const metadata = { title: "Form Nilai Katrol" };

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; subject?: string; semester?: string }> }) {
  const { classId = "", subject = "", semester = "" } = await searchParams;
  const q = new URLSearchParams({ classId, subject, semester }).toString();
  return <CetakFormKatrol classId={classId} subject={subject} semester={semester} kembaliHref={`/dashboard/admin/form-nilai-rapor?${q}`} />;
}
