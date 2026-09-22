import HalamanCetakRapor from "@/components/rapor/HalamanCetakRapor";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cetak Rapor" };

export default async function Page({ searchParams }: { searchParams: Promise<{ classId?: string; semester?: string; jenis?: string; siswa?: string; dari?: string }> }) {
  const sp = await searchParams;
  const kembali = sp.dari === "pengesahan" ? "/dashboard/teacher/kepala-sekolah/rapor" : "/dashboard/teacher/rapor-kelas";
  return <HalamanCetakRapor sp={sp} basePath="/dashboard/teacher/rapor-kelas/cetak" kembaliHref={kembali} />;
}
