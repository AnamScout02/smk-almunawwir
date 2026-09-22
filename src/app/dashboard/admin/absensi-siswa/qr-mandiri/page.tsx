export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import LayarQrAbsensi from "@/components/shared/LayarQrAbsensi";

export default async function AdminLayarQrAbsensiPage() {
  await verifyRole(["ADMIN", "TAS"]);
  return <LayarQrAbsensi backHref="/dashboard/admin/absensi-siswa" />;
}
