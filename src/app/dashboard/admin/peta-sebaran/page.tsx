export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import { jabatanAtauAlihkan } from "@/lib/jabatan-guard";
import { assertPeta } from "@/lib/peta-guard";
import PetaSebaranHalaman from "@/components/shared/PetaSebaranHalaman";

export default async function Page() {
  const session = await verifyRole(["ADMIN", "TAS"]);
  await jabatanAtauAlihkan(session, () => assertPeta(session));
  return <PetaSebaranHalaman basePath="/dashboard/admin" />;
}
