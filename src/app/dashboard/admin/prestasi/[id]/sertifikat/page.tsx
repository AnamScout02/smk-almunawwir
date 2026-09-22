export const dynamic = "force-dynamic";

import SertifikatPrestasiCetak from "@/components/kesiswaan/SertifikatPrestasiCetak";

export const metadata = { title: "Piagam Prestasi" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SertifikatPrestasiCetak id={id} kembaliHref="/dashboard/admin/papan-kesiswaan" />;
}
