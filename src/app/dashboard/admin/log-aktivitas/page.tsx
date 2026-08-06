import { verifyRole } from "@/lib/dal";
import LogAktivitasClient from "@/components/admin/LogAktivitasClient";

// Khusus ADMIN (superadmin) — sengaja TIDAK diloloskan TAS/guru-TU sekalipun mereka bisa masuk
// layout admin (lihat tas-access-guard.ts), karena log ini juga mencatat aksi mereka sendiri.
export default async function LogAktivitasPage() {
  await verifyRole(["ADMIN"]);
  return <LogAktivitasClient />;
}
