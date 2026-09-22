import PemeriksaanManager from "@/components/uks/PemeriksaanManager";

export const metadata = { title: "Pemeriksaan Kesehatan" };

export default function Page() {
  return <PemeriksaanManager kembaliHref="/dashboard/teacher/uks" />;
}
