import { verifyRole } from "@/lib/dal";
import PemeriksaJadwalManager from "@/components/admin/PemeriksaJadwalManager";

export const dynamic = "force-dynamic";

export default async function Page() {
  await verifyRole(["ADMIN", "TAS"]);
  return <PemeriksaJadwalManager />;
}
