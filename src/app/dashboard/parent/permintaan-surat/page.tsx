export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import PermintaanSuratPortal from "@/components/shared/PermintaanSuratPortal";

export const metadata = { title: "Permintaan Surat — Portal Orang Tua" };

export default async function PermintaanSuratOrangTuaPage() {
  await verifyRole(["PARENT"]);
  return <PermintaanSuratPortal untukOrangTua />;
}
