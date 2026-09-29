import { verifyRole } from "@/lib/dal";
import PantauMasukanRekan from "@/components/admin/PantauMasukanRekan";

export const dynamic = "force-dynamic";

/** Khusus Superadmin: satu-satunya layar yang menampilkan pasangan pengirim–penerima. */
export default async function Page() {
  await verifyRole(["ADMIN"]);
  return <PantauMasukanRekan />;
}
