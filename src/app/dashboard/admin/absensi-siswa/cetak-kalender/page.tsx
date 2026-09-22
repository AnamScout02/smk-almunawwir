export const dynamic = "force-dynamic";

import KalenderAbsensiCetak, { metadataKalenderAbsensi, type ParamKalender } from "@/components/shared/KalenderAbsensiCetak";

export const generateMetadata = metadataKalenderAbsensi;

export default function CetakKalenderAbsensiPage({ searchParams }: { searchParams: ParamKalender }) {
  return <KalenderAbsensiCetak searchParams={searchParams} basePath="/dashboard/admin/absensi-siswa/cetak-kalender" kembaliHref="/dashboard/admin/absensi-siswa" />;
}
