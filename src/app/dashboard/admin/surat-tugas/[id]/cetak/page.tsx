export const dynamic = "force-dynamic";
import { verifyTasAccess } from "@/lib/tas-access-guard";
import CetakSuratTugas from "@/components/surat/CetakSuratTugas";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  await verifyTasAccess();
  const { id } = await params;
  return <CetakSuratTugas id={id} />;
}
