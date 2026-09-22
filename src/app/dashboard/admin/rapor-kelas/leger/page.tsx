import HalamanLegerRapor from "@/components/rapor/HalamanLegerRapor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Leger Nilai Rapor" };

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; semester?: string }> }) {
  return <HalamanLegerRapor sp={await searchParams} kembaliHref="/dashboard/admin/rapor-kelas" />;
}
