import { verifyTasAccess } from "@/lib/tas-access-guard";
import NominatifManager from "@/components/admin/NominatifManager";

export const metadata = { title: "Nominatif Kelas XII — Dashboard Admin" };

export default async function NominatifPage() {
  await verifyTasAccess();
  return <NominatifManager />;
}
