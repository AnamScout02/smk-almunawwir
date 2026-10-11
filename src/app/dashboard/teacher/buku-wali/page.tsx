export const dynamic = "force-dynamic";
import { verifyRole } from "@/lib/dal";
import HalamanBukuWali from "@/components/wali/HalamanBukuWali";

export const metadata = { title: "Buku Wali Kelas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kelas?: string }> }) {
  const session = await verifyRole(["TEACHER"]);
  return <HalamanBukuWali session={session} kelas={(await searchParams).kelas} basePath="/dashboard/teacher/buku-wali" />;
}
