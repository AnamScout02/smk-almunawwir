export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import HalamanBukuWali from "@/components/wali/HalamanBukuWali";

export const metadata = { title: "Buku Wali Kelas" };

/** Superadmin melihat buku wali kelas mana pun lewat portalnya sendiri (CLAUDE.md #55). */
export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string }> }) {
  const session = await verifyRole(["ADMIN"]);
  return <HalamanBukuWali session={session} kelas={(await searchParams).kelas} basePath="/dashboard/admin/buku-wali" />;
}
