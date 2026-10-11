import { verifyRole } from "@/lib/dal";
import EkstraSaya from "@/components/ekstra/EkstraSaya";

export const metadata = { title: "Ekstrakurikuler Anak — Portal Orang Tua" };

/** Orang tua hanya membaca; anak yang dilihat mengikuti pemilih anak (`?studentId=`), disahkan lagi di server. */
export default async function Page({ searchParams }: { searchParams: Promise<{ studentId?: string }> }) {
  await verifyRole(["PARENT"]);
  const { studentId } = await searchParams;
  return <EkstraSaya anak={studentId} />;
}
