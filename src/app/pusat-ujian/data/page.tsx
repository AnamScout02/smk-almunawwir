import { verifyRole } from "@/lib/dal";
import CadanganDataManager from "@/components/ujian/CadanganDataManager";

export const dynamic = "force-dynamic";

export default async function CadanganDataPage() {
  const session = await verifyRole(["ADMIN", "TAS", "TEACHER"]);
  return <CadanganDataManager basePath="/pusat-ujian" isAdmin={session.role === "ADMIN"} />;
}
