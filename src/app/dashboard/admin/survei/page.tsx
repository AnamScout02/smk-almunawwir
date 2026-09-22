import SurveiManager from "@/components/survei/SurveiManager";

export const metadata = { title: "Kelola Survei" };

export default function Page() {
  return <SurveiManager isiHref="/dashboard/admin/survei-saya" />;
}
