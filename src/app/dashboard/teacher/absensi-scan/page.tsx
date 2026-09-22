export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import AbsensiScanStation from "@/components/shared/AbsensiScanStation";

// Scan kartu pelajar oleh guru (mis. petugas piket di gerbang) — dengan alat scanner atau kamera HP.
export default async function GuruAbsensiScanPage() {
  await verifyRole(["TEACHER"]);
  return <AbsensiScanStation backHref="/dashboard/teacher" />;
}
