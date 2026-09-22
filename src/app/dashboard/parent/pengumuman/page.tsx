export const dynamic = "force-dynamic";

import { verifyRole } from "@/lib/dal";
import { getParentChildrenOrRedirect } from "@/lib/parent-guard";
import PengumumanMasuk from "@/components/shared/PengumumanMasuk";

export const metadata = { title: "Pengumuman — Portal Orang Tua" };

export default async function ParentPengumumanPage() {
  const session = await verifyRole(["PARENT"]);
  await getParentChildrenOrRedirect(session); // pastikan akun ortu punya anak terhubung sebelum tampilkan apapun
  return <PengumumanMasuk session={session} keterangan="Informasi dari sekolah untuk Orang Tua/Wali" />;
}
