import PengumumanManager from "@/components/shared/PengumumanManager";

export const metadata = { title: "Kelola Pengumuman" };

export default function Page() {
  return <PengumumanManager kotakHref="/dashboard/teacher/pengumuman" kembaliHref="/dashboard/teacher/pengumuman" />;
}
