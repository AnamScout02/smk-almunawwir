import PapanKesiswaan from "@/components/kesiswaan/PapanKesiswaan";

export const metadata = { title: "Papan Kesiswaan" };

export default function Page() {
  return <PapanKesiswaan sertifikatBase="/dashboard/admin/prestasi" />;
}
