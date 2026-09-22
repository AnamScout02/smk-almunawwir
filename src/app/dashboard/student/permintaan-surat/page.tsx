export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import PermintaanSuratPortal from "@/components/shared/PermintaanSuratPortal";

export const metadata = { title: "Permintaan Surat — Portal Siswa" };

export default async function PermintaanSuratSiswaPage() {
  await verifyRole(["STUDENT"]);
  return <PermintaanSuratPortal />;
}
