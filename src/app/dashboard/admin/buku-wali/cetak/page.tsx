export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import BukuWaliCetak from "@/components/wali/BukuWaliCetak";

export const metadata = { title: "Lembar Siswa — Buku Wali Kelas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string; siswa?: string }> }) {
  const session = await verifyRole(["ADMIN"]);
  const { kelas, siswa } = await searchParams;
  return <BukuWaliCetak session={session} kelas={kelas} siswa={siswa} basePath="/dashboard/admin/buku-wali" />;
}
