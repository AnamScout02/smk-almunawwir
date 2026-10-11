export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertPantauGuru } from "@/lib/pantau-guru";
import RaporKinerjaDaftar from "@/components/kinerja/RaporKinerjaDaftar";

export const metadata = { title: "Rapor Kinerja Guru" };

export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  await jabatanAtauAlihkan(session, () => assertPantauGuru(session));
  return <RaporKinerjaDaftar basePath="/dashboard/admin/rapor-kinerja" />;
}
