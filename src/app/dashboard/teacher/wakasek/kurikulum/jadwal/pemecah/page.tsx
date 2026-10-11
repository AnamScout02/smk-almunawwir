import PemecahJadwalManager from "@/components/kurikulum/PemecahJadwalManager";

export const metadata = { title: "Pemecah Jadwal" };

export default function Page() {
  return <PemecahJadwalManager kembaliHref="/dashboard/teacher/wakasek/kurikulum/jadwal" />;
}
