export const dynamic = "force-dynamic";
import { verifySpmbAccess } from "@/lib/spmb";
import LaporanSebaranSheet from "@/components/shared/LaporanSebaranSheet";

export const metadata = { title: "Laporan Sebaran" };

export default async function Page({ searchParams }: { searchParams: Promise<{ dari?: string; sampai?: string }> }) {
  await verifySpmbAccess();
  const { dari, sampai } = await searchParams;
  return <LaporanSebaranSheet kembaliHref="/pusat-spmb/sasaran" alamat="/pusat-spmb/sasaran/laporan" dari={dari} sampai={sampai} />;
}
