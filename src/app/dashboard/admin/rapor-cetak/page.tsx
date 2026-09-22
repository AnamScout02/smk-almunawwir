import HalamanCetakRapor from "@/components/rapor/HalamanCetakRapor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cetak Rapor" };

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; semester?: string; jenis?: string; siswa?: string; dari?: string }> }) {
  const sp = await searchParams;
  return <HalamanCetakRapor sp={sp} basePath="/dashboard/admin/rapor-cetak" kembaliHref={sp.dari === "rapor-kelas" ? "/dashboard/admin/rapor-kelas" : "/dashboard/admin/pengesahan-rapor"} />;
}
