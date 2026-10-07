export const dynamic = "force-dynamic";
import AlokasiDanaCetak from "@/components/keuangan/AlokasiDanaCetak";

export const metadata = { title: "Cetak Alokasi Dana" };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  return <AlokasiDanaCetak id={(await searchParams).id ?? ""} kembaliHref="/dashboard/teacher/alokasi-dana" />;
}
