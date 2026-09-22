export const dynamic = "force-dynamic";

import LabelAsetCetak from "@/components/sarpras/LabelAsetCetak";

export const metadata = { title: "Label QR Aset" };

export default function Page({ searchParams }: { searchParams: Promise<{ kategori?: string; lokasi?: string }> }) {
  return <LabelAsetCetak searchParams={searchParams} basePath="/dashboard/teacher/wakasek/sarpras/label-aset" kembaliHref="/dashboard/teacher/wakasek/sarpras" />;
}
