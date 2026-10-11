import RuangJadwalManager from "@/components/kurikulum/RuangJadwalManager";

export const metadata = { title: "Ruang per Mapel" };

export default function Page() {
  return <RuangJadwalManager kembaliHref="/dashboard/admin/schedules" />;
}
