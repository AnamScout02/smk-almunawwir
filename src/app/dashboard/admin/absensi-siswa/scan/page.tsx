export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import AbsensiScanStation from "@/components/shared/AbsensiScanStation";

export default async function AdminAbsensiScanPage() {
  await verifyRole(["ADMIN", "TAS"]);
  return <AbsensiScanStation backHref="/dashboard/admin/absensi-siswa" />;
}
