export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import PengumumanMasuk from "@/components/shared/PengumumanMasuk";

export const metadata = { title: "Pengumuman" };

export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS"]);
  return <PengumumanMasuk session={session} kelolaHref="/dashboard/admin/announcements" />;
}
