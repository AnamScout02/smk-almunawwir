export const dynamic = "force-dynamic";

import KalenderAbsensiCetak, { metadataKalenderAbsensi, type ParamKalender } from "@/components/shared/KalenderAbsensiCetak";

export const generateMetadata = metadataKalenderAbsensi;

export default function CetakKalenderKesiswaanPage({ searchParams }: { searchParams: ParamKalender }) {
  return <KalenderAbsensiCetak searchParams={searchParams} basePath="/dashboard/teacher/kesiswaan/absensi-siswa/cetak-kalender" kembaliHref="/dashboard/teacher/kesiswaan/absensi-siswa" />;
}
